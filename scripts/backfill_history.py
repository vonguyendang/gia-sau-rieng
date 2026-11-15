#!/usr/bin/env python3
"""
scripts/backfill_history.py

Script cào lùi lịch sử (Backfill) video thật từ YouTube:
1. Quét danh sách video trong quá khứ của các kênh trong channels.json
2. Lọc video báo giá sầu riêng
3. Lấy phụ đề tiếng Việt
4. Phân tích qua Gemini API (lấy giá xô tại vườn)
5. Cập nhật vào public/data/history.json
"""

import os
import sys
import json
import time
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "public" / "data"
CHANNELS_FILE = DATA_DIR / "channels.json"
PROCESSED_FILE = DATA_DIR / "processed_videos.json"
HISTORY_FILE = DATA_DIR / "history.json"
ENV_FILE = ROOT_DIR / ".env"

# Tự động nạp .env
if ENV_FILE.exists():
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k and not os.getenv(k):
                        os.environ[k] = v
    except Exception:
        pass

# Đảm bảo thư mục scripts nằm trong sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Import các hàm từ fetch_prices
from fetch_prices import (
    fetch_channel_videos,
    fetch_all_channel_videos,
    get_video_transcript,
    call_gemini_api,
    calculate_daily_average,
    normalize_bulk_prices,
    load_json,
    save_json,
    safe_sleep,
    is_durian_title,
    has_durian_content,
    VN_TZ,
)


def extract_date_from_title(title: str, fallback_dt: datetime) -> str:
    """
    Trích xuất ngày dạng YYYY-MM-DD từ tiêu đề video (ví dụ: 'ngày 11/11/2026', 'ngày 10 tháng 11', '10/11').
    """
    # Pattern dạng DD/MM/YYYY
    m1 = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", title)
    if m1:
        d, m, y = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
        return f"{y:04d}-{m:02d}-{d:02d}"

    # Pattern dạng DD tháng MM
    m2 = re.search(r"(\d{1,2})\s*tháng\s*(\d{1,2})", title, re.IGNORECASE)
    if m2:
        d, m = int(m2.group(1)), int(m2.group(2))
        y = fallback_dt.year
        return f"{y:04d}-{m:02d}-{d:02d}"

    # Pattern dạng DD/MM
    m3 = re.search(r"(\d{1,2})/(\d{1,2})", title)
    if m3:
        d, m = int(m3.group(1)), int(m3.group(2))
        y = fallback_dt.year
        return f"{y:04d}-{m:02d}-{d:02d}"

    return fallback_dt.strftime("%Y-%m-%d")


def main():
    max_videos_per_channel = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(f"=== BẮT ĐẦU CÀO LÙI LỊCH SỬ THẬT TỪ YOUTUBE (Tối đa {max_videos_per_channel} video/kênh) ===")

    channels = load_json(CHANNELS_FILE, [])
    processed_videos = load_json(PROCESSED_FILE, {})
    history_data = load_json(HISTORY_FILE, {"last_updated": "", "days": {}})

    # Sắp xếp kênh ưu tiên lên đầu
    channels = sorted(channels, key=lambda c: (not c.get("is_primary", False), c.get("priority", 99)))

    total_backfilled = 0

    for ch in channels:
        if not ch.get("enabled", True):
            continue

        cid = ch.get("channel_id")
        handle = ch.get("handle", "")
        name = ch.get("name")
        region = ch.get("region", "Chung")

        print(f"\n>> Đang lấy danh sách video cũ từ: {name} ({handle or cid})")
        videos = fetch_all_channel_videos(cid, handle)
        print(f"   Tìm thấy {len(videos)} video trên kênh.")

        # Lọc nghiêm ngặt: CHỈ lấy các video mà trong TIÊU ĐỀ có chữ "sầu riêng" (hoặc "sau rieng")
        durian_videos = [
            v for v in videos
            if is_durian_title(v.get("title", ""))
        ]
        print(f"   -> Có {len(durian_videos)} video có chữ 'sầu riêng' trong tiêu đề.")

        # Lọc ra các video CHƯA TỪNG xử lý hoặc trước đó chưa kịp có phụ đề (cho phép thử lại)
        unprocessed_videos = [
            v for v in durian_videos
            if v["video_id"] not in processed_videos or processed_videos[v["video_id"]].get("has_transcript") is not True
        ]
        print(f"   -> Có {len(unprocessed_videos)} video sầu riêng chưa xử lý (sẽ xử lý tối đa {max_videos_per_channel} video đợt này).")

        if not unprocessed_videos:
            print("   -> Kênh này đã xử lý hết các video sầu riêng tìm thấy. Bỏ qua.")
            continue

        for v in unprocessed_videos[:max_videos_per_channel]:
            vid = v["video_id"]
            title = v["title"]
            pub_dt = v["published_dt"]

            print(f"\n   [+] Đang xử lý: [{vid}] {title}")
            transcript = get_video_transcript(vid)

            if not transcript:
                print("       -> Không có phụ đề tiếng Việt. Ghi nhận bỏ qua.")
                processed_videos[vid] = {
                    "channel_id": cid,
                    "title": title,
                    "processed_at": datetime.now(VN_TZ).isoformat(),
                    "has_transcript": False,
                    "is_price_video": False,
                }
                save_json(PROCESSED_FILE, processed_videos)
                safe_sleep(3.0, 5.0, msg="chờ sau khi video không có phụ đề")
                continue

            # Kiểm tra an toàn phụ đề
            if not has_durian_content(title, transcript):
                print("       -> Phụ đề không chứa thông tin về sầu riêng. Ghi nhận bỏ qua.")
                processed_videos[vid] = {
                    "channel_id": cid,
                    "title": title,
                    "processed_at": datetime.now(VN_TZ).isoformat(),
                    "has_transcript": True,
                    "is_price_video": False,
                }
                save_json(PROCESSED_FILE, processed_videos)
                safe_sleep(2.0, 4.0, msg="nghỉ ngắn")
                continue

            print(f"       -> Lấy được phụ đề ({len(transcript)} ký tự). Đang gửi Gemini phân tích giá xô...")

            prompt = f"""
KÊNH: {name} (Khu vực mặc định: {region})
TIÊU ĐỀ VIDEO: {title}
NỘI DUNG PHỤ ĐỀ:
\"\"\"{transcript[:8000]}\"\"\"
"""
            extracted = call_gemini_api(prompt)

            if not extracted:
                print("       -> [LỖI] Gemini API không trả về kết quả.")
                safe_sleep(4.0, 7.0, msg="chờ sau lỗi AI")
                continue

            is_price_video = extracted.get("is_price_video", False)
            raw_prices = extracted.get("prices", {})
            prices = normalize_bulk_prices(raw_prices)
            summary = extracted.get("summary", "")
            reg = extracted.get("region") or region

            processed_videos[vid] = {
                "channel_id": cid,
                "title": title,
                "processed_at": datetime.now(VN_TZ).isoformat(),
                "has_transcript": True,
                "is_price_video": is_price_video,
                "prices": prices if is_price_video else None,
            }
            save_json(PROCESSED_FILE, processed_videos)

            if is_price_video:
                day_key = extract_date_from_title(title, pub_dt.astimezone(VN_TZ))
                print(f"       -> ✅ Trích xuất thành công ngày {day_key}: {prices}")

                if day_key not in history_data["days"]:
                    history_data["days"][day_key] = {
                        "daily_average": {},
                        "sources": [],
                    }

                source_item = {
                    "video_id": vid,
                    "title": title,
                    "channel_name": name,
                    "channel_id": cid,
                    "video_url": v["link"],
                    "published_at": v["published_at"],
                    "region": reg,
                    "summary": summary,
                    "prices": prices,
                }

                sources = history_data["days"][day_key].setdefault("sources", [])
                if not any(s.get("video_id") == vid for s in sources):
                    sources.append(source_item)
                    total_backfilled += 1

                # Tính lại giá trung bình với ưu tiên kênh chỉ định
                history_data["days"][day_key]["daily_average"] = calculate_daily_average(sources)
                history_data["last_updated"] = datetime.now(VN_TZ).isoformat()
                save_json(HISTORY_FILE, history_data)
            else:
                print("       -> Video không chứa thông tin báo giá sầu riêng.")

            # Nghỉ ngẫu nhiên an toàn giữa các video
            safe_sleep(3.5, 6.5, msg="giãn cách an toàn giữa các video cũ")

        # Nghỉ an toàn khi chuyển kênh
        safe_sleep(4.0, 8.0, msg="chuyển kênh tiếp theo")

    # Sắp xếp lại danh sách ngày theo thứ tự thời gian
    history_data["days"] = dict(sorted(history_data["days"].items()))
    save_json(HISTORY_FILE, history_data)

    print(f"\n=== HOÀN TẤT CÀO LÙI LỊCH SỬ. Đã thêm mới {total_backfilled} bản ghi giá thật vào history.json ===")


if __name__ == "__main__":
    main()

