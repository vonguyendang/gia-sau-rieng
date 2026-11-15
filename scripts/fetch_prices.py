#!/usr/bin/env python3
"""
scripts/fetch_prices.py

Điều phối thu thập và tổng hợp giá sầu riêng tự động từ YouTube:
1. Đọc danh sách kênh từ public/data/channels.json
2. Quét video mới trong vòng 48h (ưu tiên RSS, fallback trang kênh / playlist)
3. Kiểm tra trạng thái video trong public/data/processed_videos.json
4. Lấy phụ đề tiếng Việt (youtube-transcript-api / yt-dlp anti-bot)
5. Trích xuất khoảng giá xô qua Gemini API (Structured Outputs / Multimodal)
6. Chuẩn hóa giá và tổng hợp giá trung bình ngày, theo 3 vùng miền trong public/data/history.json

Các thành phần chi tiết được tách nhỏ thành các module trong thư mục scripts/:
- utils.py: Tiện ích an toàn, cấu hình đường dẫn, bộ lọc tiêu đề & thời gian
- youtube_crawler.py: Thu thập video và phụ đề YouTube
- ai_extractor.py: Trích xuất và chuẩn hóa giá qua Gemini AI
- price_calculator.py: Tính toán giá trung bình và phân chia vùng miền
"""

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Thêm thư mục scripts vào sys.path để import dễ dàng khi chạy độc lập
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Re-export đầy đủ các tiện ích để đảm bảo tương thích ngược 100% với backfill_history.py
from utils import (
    ROOT_DIR,
    DATA_DIR,
    CHANNELS_FILE,
    PROCESSED_FILE,
    HISTORY_FILE,
    ENV_FILE,
    VN_TZ,
    USER_AGENTS,
    DURIAN_KEYWORDS,
    DURIAN_TITLE_REGEX,
    get_safe_headers,
    safe_sleep,
    safe_requests_get,
    is_durian_title,
    has_durian_content,
    load_json,
    save_json,
    parse_relative_time,
)

from youtube_crawler import (
    fetch_channel_videos_via_page,
    fetch_channel_videos_via_playlist,
    fetch_channel_videos,
    fetch_all_channel_videos,
    get_transcript_via_ytdlp,
    get_video_transcript,
)

from ai_extractor import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    PRICE_SCHEMA,
    SYSTEM_INSTRUCTION,
    normalize_bulk_prices,
    call_gemini_api,
)

from price_calculator import (
    calculate_daily_average,
    calculate_regional_data,
)


def main():
    """Quy trình thu thập và cập nhật giá sầu riêng định kỳ."""
    print(f"=== BẮT ĐẦU CẬP NHẬT GIÁ SẦU RIÊNG ({datetime.now(VN_TZ).strftime('%Y-%m-%d %H:%M:%S')} ICT) ===")

    channels = load_json(CHANNELS_FILE, [])
    processed_videos = load_json(PROCESSED_FILE, {})
    history_data = load_json(HISTORY_FILE, {"last_updated": "", "days": {}})

    if not channels:
        print("[WARN] Danh sách kênh rỗng! Vui lòng kiểm tra public/data/channels.json")
        return

    # Sắp xếp kênh ưu tiên lên đầu tiên (is_primary hoặc priority nhỏ hơn)
    channels = sorted(channels, key=lambda c: (not c.get("is_primary", False), c.get("priority", 99)))

    now_utc = datetime.now(timezone.utc)
    max_age = timedelta(hours=48)
    new_price_records = 0

    for ch in channels:
        if not ch.get("enabled", True):
            continue

        channel_id = ch.get("channel_id")
        handle = ch.get("handle", "")
        channel_name = ch.get("name", "Kênh YouTube")
        default_region = ch.get("region", "Chung")

        print(f"\n>> Đang quét kênh: {channel_name} ({handle or channel_id})")
        videos = fetch_channel_videos(channel_id, handle)
        print(f"   Tìm thấy {len(videos)} video từ RSS/Trang kênh.")

        consecutive_errors = 0

        for vid in videos:
            video_id = vid["video_id"]
            title = vid["title"]
            pub_dt = vid["published_dt"]
            pub_at_iso = vid["published_at"]

            # Circuit breaker: Nếu kênh bị lỗi liên tiếp 3 lần, tạm dừng kênh này
            if consecutive_errors >= 3:
                print(f"   [CẢNH BÁO AN TOÀN] Kênh {channel_name} gặp lỗi phụ đề liên tiếp {consecutive_errors} lần. Tạm dừng quét kênh để bảo vệ an toàn IP.")
                break

            # 1. Kiểm tra video đã xử lý
            if video_id in processed_videos:
                pv = processed_videos[video_id]
                # Nếu đã có phụ đề (đã bóc tách giá hoặc xác nhận không phải video giá) -> Bỏ qua
                if pv.get("has_transcript") is True:
                    continue
                # Nếu trước đó chưa có phụ đề: Cho phép thử lại tối đa 5 lần nếu video còn mới (< 36 giờ)
                retries = pv.get("transcript_retries", 1)
                is_fresh = (now_utc - pub_dt) < timedelta(hours=36)
                if not is_fresh or retries >= 5:
                    continue
                print(f"   [Thử lại #{retries + 1}] Video '{title}' trước đó chưa có phụ đề, đang thử lại...")

            # 2. Bỏ qua nếu video cũ hơn 48 giờ
            if (now_utc - pub_dt) > max_age:
                continue

            # 3. Lọc nghiêm ngặt: TIÊU ĐỀ PHẢI CÓ CHỮ 'SẦU RIÊNG' (bỏ qua giá mít, ớt, phân bón...)
            if not is_durian_title(title):
                print(f"   [-] Bỏ qua (tiêu đề không chứa chữ 'sầu riêng'): {title}")
                processed_videos[video_id] = {
                    "channel_id": channel_id,
                    "title": title,
                    "processed_at": datetime.now(VN_TZ).isoformat(),
                    "has_transcript": None,
                    "is_price_video": False,
                }
                save_json(PROCESSED_FILE, processed_videos)
                continue

            print(f"   [+] Video mới phát hiện: {title} (ID: {video_id})")

            # 4. Lấy phụ đề tiếng Việt an toàn
            transcript = get_video_transcript(video_id)
            video_url = f"https://www.youtube.com/watch?v={video_id}"

            if not transcript:
                print("       -> Phụ đề text chưa sẵn sàng. Kích hoạt Gemini Multimodal phân tích trực tiếp video YouTube...")
                prompt = f"""
KÊNH: {channel_name} (Khu vực mặc định: {default_region})
TIÊU ĐỀ VIDEO: {title}
NGÀY ĐĂNG: {pub_at_iso}
Hãy nghe âm thanh và xem thông tin video để trích xuất bảng giá sầu riêng cắt xô tại vườn chuẩn xác nhất.
"""
                extracted = call_gemini_api(prompt, video_url=video_url)
                if not extracted:
                    prev_retries = processed_videos.get(video_id, {}).get("transcript_retries", 0)
                    print(f"       -> Chưa thể phân tích video (Lần thử {prev_retries + 1}/5). Sẽ tự động quét lại ở phiên kế tiếp.")
                    processed_videos[video_id] = {
                        "channel_id": channel_id,
                        "title": title,
                        "processed_at": datetime.now(VN_TZ).isoformat(),
                        "has_transcript": False,
                        "transcript_retries": prev_retries + 1,
                        "is_price_video": False,
                    }
                    save_json(PROCESSED_FILE, processed_videos)
                    consecutive_errors += 1
                    safe_sleep(2.0, 4.0, msg="chờ an toàn sau khi chưa có phụ đề")
                    continue
            else:
                consecutive_errors = 0

                # 5. Kiểm tra lại phụ đề có nhắc sầu riêng không
                if not has_durian_content(title, transcript):
                    print("       -> Phụ đề không chứa thông tin sầu riêng. Bỏ qua.")
                    processed_videos[video_id] = {
                        "channel_id": channel_id,
                        "title": title,
                        "processed_at": datetime.now(VN_TZ).isoformat(),
                        "has_transcript": True,
                        "is_price_video": False,
                    }
                    save_json(PROCESSED_FILE, processed_videos)
                    safe_sleep(2.0, 4.0, msg="nghỉ ngắn")
                    continue

                # 6. Chuẩn bị prompt gửi Gemini
                prompt = f"""
KÊNH: {channel_name} (Khu vực mặc định: {default_region})
TIÊU ĐỀ VIDEO: {title}
NGÀY ĐĂNG: {pub_at_iso}
NỘI DUNG PHỤ ĐỀ:
\"\"\"{transcript[:8000]}\"\"\"
"""
                print("       -> Đang gửi phụ đề cho Gemini phân tích & trích xuất khoảng giá xô...")
                extracted = call_gemini_api(prompt)

            if not extracted:
                print("       -> [LỖI] Không nhận được phản hồi hợp lệ từ Gemini. Bỏ qua video này.")
                safe_sleep(4.0, 7.0, msg="chờ sau lỗi AI")
                continue

            if isinstance(extracted, list):
                extracted = extracted[0] if len(extracted) > 0 and isinstance(extracted[0], dict) else {}

            if not isinstance(extracted, dict):
                print("       -> [LỖI] Dữ liệu từ Gemini không phải dictionary. Bỏ qua.")
                continue

            is_price_video = extracted.get("is_price_video", False)
            region = extracted.get("region") or default_region
            raw_prices = extracted.get("prices", {})
            prices = normalize_bulk_prices(raw_prices)
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

                sources = history_data["days"][day_key].setdefault("sources", [])
                if not any(s.get("video_id") == video_id for s in sources):
                    sources.append(source_record)
                    new_price_records += 1

                daily_avg = calculate_daily_average(sources)
                history_data["days"][day_key]["daily_average"] = daily_avg
                history_data["days"][day_key]["by_region"] = calculate_regional_data(sources, daily_avg)
                history_data["last_updated"] = datetime.now(VN_TZ).isoformat()
                save_json(HISTORY_FILE, history_data)

            # Nghỉ ngẫu nhiên kèm jitter giữa các video để đảm bảo an toàn tuyệt đối
            safe_sleep(3.5, 6.5, msg="giãn cách an toàn giữa các video")

        # Nghỉ an toàn khi chuyển sang kênh tiếp theo
        safe_sleep(4.0, 8.0, msg="chuyển kênh tiếp theo")

    # Cập nhật lại thời gian kiểm tra cuối cùng
    history_data["last_updated"] = datetime.now(VN_TZ).isoformat()
    save_json(HISTORY_FILE, history_data)
    save_json(PROCESSED_FILE, processed_videos)

    print(f"\n=== HOÀN TẤT. Thêm mới {new_price_records} bản ghi giá sầu riêng. ===")


if __name__ == "__main__":
    main()
