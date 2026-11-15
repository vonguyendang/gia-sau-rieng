#!/usr/bin/env python3
"""
scripts/ai_extractor.py

Trích xuất và chuẩn hóa giá sầu riêng qua Google Gemini API:
- Structured Outputs / JSON Schema định dạng chuẩn
- System instruction chuyên sâu về giá cắt xô tại vườn (tỉ lệ 7:3, 8:2)
- Hàm normalize_bulk_prices chuẩn hóa khoảng giá loại B thành giá xô
- Hỗ trợ cả google-genai SDK mới nhất và direct REST API fallback
- Hỗ trợ Gemini Multimodal phân tích trực tiếp video YouTube qua URL
"""

import os
import re
import json
import requests

# Cấu hình Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

PRICE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "is_price_video": {
            "type": "BOOLEAN",
            "description": "True nếu video có đề cập đến thông tin bảng giá thu mua sầu riêng; False nếu chỉ là video thuần kỹ thuật trồng trọt, giải trí hoặc không báo giá.",
        },
        "region": {
            "type": "STRING",
            "description": "Khu vực thu mua được nhắc đến trong video: 'Miền Tây', 'Tây Nguyên', 'Đông Nam Bộ' hoặc 'Chung'.",
        },
        "prices": {
            "type": "OBJECT",
            "description": "Bảng giá thu mua đơn vị VNĐ/kg (số nguyên, ví dụ: 85000). Nếu không có giá của loại nào thì để null, TUYỆT ĐỐI KHÔNG để 0.",
            "properties": {
                "ri6_a": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Ri6 xô tỉ lệ 8:2 (vườn đẹp, VNĐ/kg, vd: 53000), null nếu không nhắc tới.",
                },
                "ri6_b": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Ri6 xô tỉ lệ 7:3 (vườn trung bình, VNĐ/kg, vd: 48000), null nếu không nhắc tới.",
                },
                "monthong_a": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Monthong (Thái/Dona) xô tỉ lệ 8:2 (vườn đẹp, VNĐ/kg, vd: 78000), null nếu không nhắc tới.",
                },
                "monthong_b": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Monthong (Thái/Dona) xô tỉ lệ 7:3 (vườn trung bình, VNĐ/kg, vd: 70000), null nếu không nhắc tới.",
                },
                "musang_king": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Musang King (VNĐ/kg), null nếu không nhắc tới.",
                },
                "black_thorn": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Black Thorn / Gai Đen (VNĐ/kg), null nếu không nhắc tới.",
                },
                "chuong_bo": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Chuồng Bò (VNĐ/kg), null nếu không nhắc tới.",
                },
                "sau_huu": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Sáu Hữu (VNĐ/kg), null nếu không nhắc tới.",
                },
            },
            "required": ["ri6_a", "ri6_b", "monthong_a", "monthong_b", "musang_king"],
        },
        "summary": {
            "type": "STRING",
            "description": "Tóm tắt ngắn gọn 1-2 câu về tình hình thu mua hoặc biến động giá sầu riêng trong video.",
        },
    },
    "required": ["is_price_video", "region", "prices", "summary"],
}

SYSTEM_INSTRUCTION = """
Bạn là một chuyên gia phân tích dữ liệu thị trường nông sản Việt Nam, chuyên về sầu riêng.
Nhiệm vụ của bạn là đọc phụ đề và thông tin video YouTube để trích xuất bảng GIÁ SẦU RIÊNG CẮT XÔ TẠI VƯỜN (Farm-gate Bulk Price) chuẩn xác nhất cho bà con nông dân.

QUY TẮC BẮT BUỘC VỀ GIÁ CẮT XÔ TẠI VƯỜN (FARM-GATE BULK PRICE):
1. QUY TẮC CỐT LÕI: NẾU VIDEO NÓI GIÁ CỤ THỂ LOẠI A, LOẠI B THÌ MỨC GIÁ LOẠI B CHÍNH LÀ MỨC GIÁ XÔ THEO TỈ LỆ A/B 7/3, 8/2:
   - Trong thực tế thu mua sầu riêng tại vườn, giá loại A (ví dụ 65k - 70k cho Ri6, hoặc 90k - 98k cho Thái) là giá tuyển chọn từng quả đẹp xuất khẩu tại kho/vựa. Khi thương lái vào vườn cắt xô cả vườn (tỉ lệ A/B 7/3 hoặc 8/2), MỨC GIÁ LOẠI B CHÍNH LÀ MỨC GIÁ XÔ CẢ VƯỜN!
   - Do đó, khi video báo riêng giá loại A và giá loại B:
     + BẮT BUỘC LẤY MỨC GIÁ LOẠI B LÀM GIÁ XÔ TẠI VƯỜN!
     + Nếu loại B có khoảng giá (ví dụ: Ri6 loại B từ 45.000 đến 50.000 đ/kg):
       * Gán cận dưới loại B (45000) vào `ri6_b`.
       * Gán cận trên loại B (50000) vào `ri6_a`.
     + Nếu loại B chỉ có 1 mức giá (ví dụ: Ri6 loại B giá 50.000 đ/kg, loại A 70.000 đ/kg):
       * Giá xô cả vườn chính là 50.000 đ/kg: gán `ri6_b: 50000` và `ri6_a: 50000`.
     + TUYỆT ĐỐI KHÔNG lấy giá loại A (hàng tuyển) gán vào khoảng giá xô vườn, vì nông dân bán xô nguyên vườn không thể tính bằng giá loại A!
   - Tương tự với sầu riêng Thái (Monthong / Dona): nếu video nói "Thái loại A 92k-98k, loại B 72k-78k" thì giá xô vườn tỉ lệ 7/3 8/2 là 72k-78k (gán `monthong_b: 72000`, `monthong_a: 78000`).

2. KHI VIDEO BÁO TRỰC TIẾP KHOẢNG GIÁ XÔ:
   - "Ri6 xô A/B tỉ lệ 7:3 8:2 giá 48-53" có nghĩa là giá mua xô cả vườn dao động từ MIN 48.000 đến MAX 53.000 đ/kg:
     * Giá thấp hơn trong khoảng (vd 48.000) là min/sàn tỉ lệ 7:3: gán vào `ri6_b`.
     * Giá cao hơn trong khoảng (vd 53.000) là max/trần tỉ lệ 8:2: gán vào `ri6_a`.
   - "Thái xô 70 - 75" gán min vào `monthong_b` (70000), max vào `monthong_a` (75000).
   - Với các giống đặc sản (Musang King, Black Thorn, Chuồng Bò, Sáu Hữu): nếu video có nói giá loại B thì lấy giá loại B làm giá xô tại vườn.

3. LƯU Ý VỀ TỈ LỆ CẮT XÔ:
   - TỈ LỆ TRÁI (8:2, 7:3...): Là tỉ lệ phân loại trái khi mua xô cả vườn (8:2 = 80% A và 20% B). Tuyệt đối KHÔNG nhầm tỉ lệ thành giá tiền!
   - Đưa chi tiết tỉ lệ xô vào phần 'summary' để người nông dân hiểu rõ.

4. NHẬN DIỆN GIỌNG NÓI ĐỊA PHƯƠNG & QUY ĐỔI TIỀN:
   - "di sáu", "zi sáu", "ri 6", "sáu ri" -> Ri6.
   - "mỏn thon", "mỏn", "mon thong", "thái", "dona" -> Thái (Monthong/Dona).
   - "mút sang kinh", "musang" -> Musang King.
   - "gai đen", "black thorn" -> Black Thorn.
   - "chuồng bò", "chuồn bò" -> Chuồng Bò.
   - "sáu hữu", "6 hữu" -> Sáu Hữu.
   - "tám lăm", "85k" -> 85000; "trăm hai", "120k" -> 120000; "hai trăm rưỡi", "250k" -> 250000.

5. BẮT BUỘC:
   - Nếu giống sầu riêng nào không được nhắc đến, giá trị BẮT BUỘC là null (tuyệt đối không để 0).
   - is_price_video: false nếu không phải video báo giá sầu riêng.
   - Trả về JSON đúng định dạng theo schema đã yêu cầu.
"""


def normalize_bulk_prices(prices: dict) -> dict:
    """
    Chuẩn hóa khoảng giá xô vườn theo quy tắc cốt lõi:
    Nếu video có nói giá cụ thể loại A, loại B thì mức giá loại B chính là mức giá xô theo tỉ lệ A/B 7/3, 8/2.
    Tự động ngăn chặn trường hợp lấy nhầm giá hàng tuyển loại A (chênh lệch > 10.000 đ/kg) vào khoảng giá xô vườn.
    """
    if not isinstance(prices, dict):
        return {}

    cleaned = dict(prices)

    # 1. Xử lý Ri6
    ri6_a = cleaned.get("ri6_a")
    ri6_b = cleaned.get("ri6_b")
    if ri6_a and ri6_b:
        # Nếu chênh lệch > 10.000 đ/kg thì ri6_a là giá hàng tuyển loại A (65k-70k), ri6_b là loại B (45k-50k)
        if ri6_a - ri6_b > 10000:
            cleaned["ri6_a"] = ri6_b + 5000
    elif ri6_b and not ri6_a:
        cleaned["ri6_a"] = ri6_b
    elif ri6_a and not ri6_b and ri6_a <= 55000:
        cleaned["ri6_b"] = ri6_a

    # 2. Xử lý Thái (Monthong / Dona)
    mo_a = cleaned.get("monthong_a")
    mo_b = cleaned.get("monthong_b")
    if mo_a and mo_b:
        # Nếu chênh lệch > 12.000 đ/kg thì mo_a là giá hàng tuyển loại A (90k-98k), mo_b là loại B (70k-75k)
        if mo_a - mo_b > 12000:
            cleaned["monthong_a"] = mo_b + 5000
    elif mo_b and not mo_a:
        cleaned["monthong_a"] = mo_b
    elif mo_a and not mo_b and mo_a <= 80000:
        cleaned["monthong_b"] = mo_a

    # 3. Xử lý Sáu Hữu (nếu video báo giá loại A ~78k-90k, quy chuẩn về giá xô loại B 50k-55k)
    sau_huu = cleaned.get("sau_huu")
    if sau_huu and sau_huu > 70000:
        cleaned["sau_huu"] = 55000

    # 4. Xử lý Chuồng Bò (nếu báo giá loại A > 60k, quy chuẩn về giá xô loại B 45k-50k)
    chuong_bo = cleaned.get("chuong_bo")
    if chuong_bo and chuong_bo > 60000:
        cleaned["chuong_bo"] = 50000

    return cleaned


def call_gemini_api(prompt_text: str, video_url: str = None) -> dict:
    """
    Gọi Gemini API với Structured Outputs (JSON Schema).
    Hỗ trợ phân tích trực tiếp video YouTube qua video_url (Gemini Multimodal)
    nếu không lấy được phụ đề text.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip() or GEMINI_API_KEY
    if not api_key:
        print("[WARN] Chưa cấu hình GEMINI_API_KEY. Bỏ qua bước gọi AI.")
        return None

    env_model = os.environ.get("GEMINI_MODEL")
    candidate_models = []
    if env_model:
        candidate_models.append(env_model)
    candidate_models.extend(["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"])
    # Loại bỏ trùng lặp giữ nguyên thứ tự
    seen = set()
    candidate_models = [m for m in candidate_models if not (m in seen or seen.add(m))]

    # Cách 1: Thử sử dụng google-genai SDK mới nhất
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        for model in candidate_models:
            try:
                if video_url:
                    contents = [
                        types.Part(
                            file_data=types.FileData(
                                file_uri=video_url,
                                mime_type="video/mp4"
                            )
                        ),
                        types.Part(text=prompt_text)
                    ]
                else:
                    contents = prompt_text

                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_schema=PRICE_SCHEMA,
                        temperature=0.1,
                    ),
                )
                raw_text = response.text.strip()
                raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                raw_text = re.sub(r"\s*```$", "", raw_text)
                parsed = json.loads(raw_text)
                if isinstance(parsed, list):
                    parsed = parsed[0] if len(parsed) > 0 and isinstance(parsed[0], dict) else {}
                return parsed
            except Exception as e:
                print(f"[WARN] SDK model {model} lỗi ({type(e).__name__}): {e}. Đang thử tiếp...")
    except ImportError:
        pass

    # Cách 2: Gọi trực tiếp Google Gemini REST API qua danh sách model
    for model in candidate_models:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            parts = []
            if video_url:
                parts.append({
                    "fileData": {
                        "mimeType": "video/mp4",
                        "fileUri": video_url
                    }
                })
            parts.append({"text": prompt_text})

            payload = {
                "contents": [
                    {
                        "parts": parts
                    }
                ],
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_INSTRUCTION}]
                },
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": PRICE_SCHEMA,
                    "temperature": 0.1,
                },
            }

            resp = requests.post(endpoint, json=payload, timeout=45)
            if resp.status_code != 200:
                print(f"[ERR] Gemini REST API model {model} lỗi HTTP {resp.status_code}. Đang thử model tiếp theo...")
                continue

            result = resp.json()
            candidates = result.get("candidates", [])
            if not candidates:
                continue

            part_text = candidates[0]["content"]["parts"][0]["text"]
            part_text = re.sub(r"^```(?:json)?\s*", "", part_text.strip())
            part_text = re.sub(r"\s*```$", "", part_text)
            parsed = json.loads(part_text)
            if isinstance(parsed, list):
                parsed = parsed[0] if len(parsed) > 0 and isinstance(parsed[0], dict) else {}
            return parsed
        except Exception as e:
            print(f"[ERR] Không thể trích xuất qua Gemini REST API model {model}: {e}")

    return None
