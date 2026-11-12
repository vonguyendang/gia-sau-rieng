#!/usr/bin/env python3
"""
scripts/fetch_prices.py

Thu thập và tổng hợp giá sầu riêng tự động từ YouTube:
1. Đọc danh sách kênh từ public/data/channels.json
2. Lấy video mới trong vòng 48h qua RSS Feed (tránh tốn quota API)
3. Kiểm tra video đã xử lý trong public/data/processed_videos.json
4. Lấy phụ đề tiếng Việt qua youtube-transcript-api
5. Trích xuất giá chuẩn xác và phân loại qua Gemini API (Structured Outputs)
6. Cập nhật và tính giá trung bình ngày trong public/data/history.json
"""

import os
import sys
import json
import time
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
import xml.etree.ElementTree as ET

import requests
try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    HAS_FEEDPARSER = False

try:
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
        CouldNotRetrieveTranscript,
    )
    HAS_TRANSCRIPT_API = True
except ImportError:
    HAS_TRANSCRIPT_API = False

# Cấu hình đường dẫn
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "public" / "data"
CHANNELS_FILE = DATA_DIR / "channels.json"
PROCESSED_FILE = DATA_DIR / "processed_videos.json"
HISTORY_FILE = DATA_DIR / "history.json"

# Múi giờ Việt Nam (UTC+7)
VN_TZ = timezone(timedelta(hours=7))

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
                    "description": "Giá sầu riêng Ri6 loại A (VNĐ/kg), null nếu không nhắc tới.",
                },
                "ri6_b": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Ri6 loại B (VNĐ/kg), null nếu không nhắc tới.",
                },
                "monthong_a": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Monthong (Thái/Dona) loại A (VNĐ/kg), null nếu không nhắc tới.",
                },
                "monthong_b": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Monthong (Thái/Dona) loại B (VNĐ/kg), null nếu không nhắc tới.",
                },
                "musang_king": {
                    "type": "INTEGER",
                    "nullable": True,
                    "description": "Giá sầu riêng Musang King (VNĐ/kg), null nếu không nhắc tới.",
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
Nhiệm vụ của bạn là đọc phụ đề và thông tin video YouTube để trích xuất bảng giá thu mua sầu riêng chuẩn xác nhất.

LƯU Ý CỰC KỲ QUAN TRỌNG VỀ NHẬN DIỆN GIỌNG NÓI VÀ TỪ ĐỊA PHƯƠNG (Miền Tây & Tây Nguyên):
1. Phụ đề tự động thường bị sai chính tả do nhận diện âm giọng địa phương:
   - "di sáu", "zi sáu", "ri 6", "sáu ri" -> Sầu riêng Ri6.
   - "mỏn thon", "mỏn", "mon thong", "thái", "dona" -> Sầu riêng Monthong (Thái/Dona).
   - "mút sang kinh", "mút san king", "musang", "mu sang" -> Sầu riêng Musang King.
2. Quy đổi đơn vị tiền tệ:
   - Nếu video nói "tám lăm", "85 nghìn", "85k", "tám mươi lăm ngàn" -> giá là 85000 (VNĐ/kg).
   - "trăm hai", "120 nghìn", "120k" -> 120000 (VNĐ/kg).
   - "hai trăm rưỡi", "250k" -> 250000 (VNĐ/kg).
3. Quy tắc phân loại A / B:
   - Loại A thường là hàng tuyển, hàng đẹp, từ 2.5 - 3 hộc trở lên (hoặc từ 1.8kg - 5kg).
   - Loại B thường là hàng dạt, méo, hộc không đều, hoặc giá thấp hơn rõ rệt.
   - Nếu trong video chỉ nhắc chung 1 mức giá cho giống đó mà không chia A/B, hãy gán giá đó cho loại A, còn loại B để null.
4. Bắt buộc:
   - Nếu giống sầu riêng nào không được nhắc đến, giá trị BẮT BUỘC là null (tuyệt đối không để 0).
   - is_price_video: Đặt là false nếu video chỉ chia sẻ kỹ thuật cắt cành, làm bông, phân bón, bẫy rầy hoặc phóng sự không có giá mua bán cụ thể.
   - Trả về JSON đúng định dạng theo schema đã yêu cầu.
"""


def load_json(file_path: Path, default):
    if not file_path.exists():
        return default
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Lỗi đọc file {file_path}: {e}")
        return default


def save_json(file_path: Path, data):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = file_path.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    temp_file.replace(file_path)


def fetch_channel_videos(channel_id: str):
    """
    Lấy danh sách video từ RSS feed của YouTube.
    Không tốn quota YouTube Data API v3.
    Hỗ trợ cả feedparser lẫn thư viện chuẩn xml.etree.ElementTree.
    """
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    try:
        resp = requests.get(rss_url, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"[WARN] Kênh {channel_id} trả về HTTP {resp.status_code}")
            return []

        videos = []

        if HAS_FEEDPARSER:
            feed = feedparser.parse(resp.content)
            for entry in feed.entries:
                video_id = entry.get("yt_videoid")
                if not video_id and "link" in entry:
                    match = re.search(r"v=([a-zA-Z0-9_-]+)", entry["link"])
                    if match:
                        video_id = match.group(1)

                if not video_id:
                    continue

                published_str = entry.get("published", "")
                try:
                    pub_dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                except Exception:
                    pub_dt = datetime.now(timezone.utc)

                videos.append({
                    "video_id": video_id,
                    "title": entry.get("title", ""),
                    "link": entry.get("link", f"https://www.youtube.com/watch?v={video_id}"),
                    "published_dt": pub_dt,
                    "published_at": pub_dt.astimezone(VN_TZ).isoformat(),
                })
        else:
            # Fallback parsing bằng xml.etree.ElementTree
            root = ET.fromstring(resp.content)
            atom_ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
            for entry in root.findall("atom:entry", atom_ns):
                vid_el = entry.find("yt:videoId", atom_ns)
                title_el = entry.find("atom:title", atom_ns)
                pub_el = entry.find("atom:published", atom_ns)
                link_el = entry.find("atom:link", atom_ns)

                video_id = vid_el.text if vid_el is not None else ""
                title = title_el.text if title_el is not None else ""
                published_str = pub_el.text if pub_el is not None else ""
                link = link_el.attrib.get("href", f"https://www.youtube.com/watch?v={video_id}") if link_el is not None else f"https://www.youtube.com/watch?v={video_id}"

                if not video_id:
                    continue

                try:
                    pub_dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                except Exception:
                    pub_dt = datetime.now(timezone.utc)

                videos.append({
                    "video_id": video_id,
                    "title": title,
                    "link": link,
                    "published_dt": pub_dt,
                    "published_at": pub_dt.astimezone(VN_TZ).isoformat(),
                })

        return videos
    except Exception as e:
        print(f"[ERR] Không thể tải RSS cho kênh {channel_id}: {e}")
        return []


def get_video_transcript(video_id: str) -> str:
    """
    Lấy phụ đề tiếng Việt của video bằng youtube-transcript-api.
    Thử cả phụ đề tạo thủ công và phụ đề auto-generated tiếng Việt.
    """
    if not HAS_TRANSCRIPT_API:
        print("[WARN] Chưa cài đặt youtube-transcript-api. Chạy 'pip install -r scripts/requirements.txt'.")
        return ""

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = None

        try:
            transcript = transcript_list.find_transcript(["vi"])
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(["vi"])
            except Exception:
                pass

        if not transcript:
            data = YouTubeTranscriptApi.get_transcript(video_id, languages=["vi"])
            return " ".join([item.get("text", "") for item in data])

        data = transcript.fetch()
        full_text = " ".join([item.get("text", "") for item in data])
        return full_text.strip()

    except Exception as e:
        print(f"[INFO] Video {video_id} không có phụ đề tiếng Việt khả dụng ({type(e).__name__})")
        return ""


def call_gemini_api(prompt_text: str) -> dict:
    """
    Gọi Gemini API với Structured Outputs (JSON Schema).
    Thử qua google-genai SDK, nếu chưa cài sẽ gọi REST API trực tiếp.
    """
    if not GEMINI_API_KEY:
        print("[WARN] Chưa cấu hình GEMINI_API_KEY. Bỏ qua bước gọi AI.")
        return None

    # Cách 1: Thử sử dụng google-genai SDK mới nhất
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt_text,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        raw_text = response.text.strip()
        # Xóa markdown block nếu có
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        return json.loads(raw_text)
    except ImportError:
        pass
    except Exception as e:
        print(f"[WARN] Lỗi khi gọi qua google-genai SDK: {e}. Thử fallback REST API...")

    # Cách 2: Gọi trực tiếp Google Gemini REST API
    try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt_text}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

        resp = requests.post(endpoint, json=payload, timeout=30)
        if resp.status_code != 200:
            print(f"[ERR] Gemini REST API lỗi HTTP {resp.status_code}: {resp.text[:200]}")
            return None

        result = resp.json()
        candidates = result.get("candidates", [])
        if not candidates:
            return None

        part_text = candidates[0]["content"]["parts"][0]["text"]
        part_text = re.sub(r"^```(?:json)?\s*", "", part_text.strip())
        part_text = re.sub(r"\s*```$", "", part_text)
        return json.loads(part_text)
    except Exception as e:
        print(f"[ERR] Không thể trích xuất qua Gemini REST API: {e}")
        return None


def calculate_daily_average(sources: list) -> dict:
    """
    Tính giá trung bình trong ngày cho từng loại sầu riêng.
    Bỏ qua các giá trị null hoặc <= 0.
    """
    price_keys = ["ri6_a", "ri6_b", "monthong_a", "monthong_b", "musang_king"]
    totals = {k: 0 for k in price_keys}
    counts = {k: 0 for k in price_keys}

    for source in sources:
        prices = source.get("prices", {})
        for k in price_keys:
            val = prices.get(k)
            if val is not None and isinstance(val, (int, float)) and val > 0:
                totals[k] += val
                counts[k] += 1

    averages = {}
    for k in price_keys:
        if counts[k] > 0:
            averages[k] = int(round(totals[k] / counts[k]))
        else:
            averages[k] = None

    return averages


def main():
    print(f"=== BẮT ĐẦU CẬP NHẬT GIÁ SẦU RIÊNG ({datetime.now(VN_TZ).strftime('%Y-%m-%d %H:%M:%S')} ICT) ===")

    channels = load_json(CHANNELS_FILE, [])
    processed_videos = load_json(PROCESSED_FILE, {})
    history_data = load_json(HISTORY_FILE, {"last_updated": "", "days": {}})

    if not channels:
        print("[WARN] Danh sách kênh rỗng! Vui lòng kiểm tra public/data/channels.json")
        return

    now_utc = datetime.now(timezone.utc)
    max_age = timedelta(hours=48)
    new_price_records = 0

    for ch in channels:
        if not ch.get("enabled", True):
            continue

        channel_id = ch.get("channel_id")
        channel_name = ch.get("name", "Kênh YouTube")
        default_region = ch.get("region", "Chung")

        print(f"\n>> Đang quét kênh: {channel_name} ({channel_id})")
        videos = fetch_channel_videos(channel_id)
        print(f"   Tìm thấy {len(videos)} video từ RSS feed.")

        for vid in videos:
            video_id = vid["video_id"]
            title = vid["title"]
            pub_dt = vid["published_dt"]
            pub_at_iso = vid["published_at"]

            # 1. Bỏ qua nếu đã từng xử lý
            if video_id in processed_videos:
                continue

            # 2. Bỏ qua nếu video cũ hơn 48 giờ
            if (now_utc - pub_dt) > max_age:
                continue

            print(f"   [+] Video mới phát hiện: {title} (ID: {video_id})")

            # 3. Lấy phụ đề tiếng Việt
            transcript = get_video_transcript(video_id)
            if not transcript:
                print(f"       -> Không có phụ đề. Đánh dấu đã quét để bỏ qua lần sau.")
                processed_videos[video_id] = {
                    "channel_id": channel_id,
                    "title": title,
                    "processed_at": datetime.now(VN_TZ).isoformat(),
                    "has_transcript": False,
                    "is_price_video": False,
                }
                save_json(PROCESSED_FILE, processed_videos)
                time.sleep(5)
                continue

            # 4. Chuẩn bị prompt gửi Gemini
            prompt = f"""
KÊNH: {channel_name} (Khu vực mặc định: {default_region})
TIÊU ĐỀ VIDEO: {title}
NGÀY ĐĂNG: {pub_at_iso}
NỘI DUNG PHỤ ĐỀ:
\"\"\"{transcript[:8000]}\"\"\"
"""
            print("       -> Đang gửi phụ đề cho Gemini phân tích & trích xuất bảng giá...")
            extracted = call_gemini_api(prompt)

            if not extracted:
                print("       -> [LỖI] Không nhận được phản hồi hợp lệ từ Gemini. Bỏ qua video này.")
                time.sleep(5)
                continue

            is_price_video = extracted.get("is_price_video", False)
            region = extracted.get("region") or default_region
            prices = extracted.get("prices", {})
            summary = extracted.get("summary", "")

            # Lưu vào danh sách đã xử lý
            processed_videos[video_id] = {
                "channel_id": channel_id,
                "title": title,
                "processed_at": datetime.now(VN_TZ).isoformat(),
                "has_transcript": True,
                "is_price_video": is_price_video,
                "extracted_prices": prices if is_price_video else None,
            }
            save_json(PROCESSED_FILE, processed_videos)

            if not is_price_video:
                print("       -> Gemini xác nhận: Đây không phải video báo giá sầu riêng.")
            else:
                print(f"       -> Trích xuất thành công: {prices}")
                # Xác định ngày theo giờ Việt Nam
                pub_vn_dt = pub_dt.astimezone(VN_TZ)
                day_key = pub_vn_dt.strftime("%Y-%m-%d")

                if day_key not in history_data["days"]:
                    history_data["days"][day_key] = {
                        "daily_average": {},
                        "sources": [],
                    }

                source_record = {
                    "video_id": video_id,
                    "title": title,
                    "channel_name": channel_name,
                    "channel_id": channel_id,
                    "video_url": vid["link"],
                    "published_at": pub_at_iso,
                    "region": region,
                    "summary": summary,
                    "prices": prices,
                }

                # Thêm hoặc cập nhật bản ghi trong sources
                sources = history_data["days"][day_key].setdefault("sources", [])
                # Kiểm tra tránh trùng lặp trong sources
                if not any(s.get("video_id") == video_id for s in sources):
                    sources.append(source_record)
                    new_price_records += 1

                # Tính lại giá trung bình của ngày đó
                history_data["days"][day_key]["daily_average"] = calculate_daily_average(sources)

                # Cập nhật thời gian
                history_data["last_updated"] = datetime.now(VN_TZ).isoformat()
                save_json(HISTORY_FILE, history_data)

            # Nghỉ 5 giây giữa mỗi video để tránh rate limit YouTube / Gemini
            print("       -> Tạm nghỉ 5 giây...")
            time.sleep(5)

    # Cập nhật lại thời gian kiểm tra cuối cùng
    history_data["last_updated"] = datetime.now(VN_TZ).isoformat()
    save_json(HISTORY_FILE, history_data)
    save_json(PROCESSED_FILE, processed_videos)

    print(f"\n=== HOÀN TẤT. Thêm mới {new_price_records} bản ghi giá sầu riêng. ===")


if __name__ == "__main__":
    main()
