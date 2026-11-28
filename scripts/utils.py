#!/usr/bin/env python3
"""
scripts/utils.py

Các hàm tiện ích dùng chung:
- Quản lý cấu hình đường dẫn & múi giờ
- HTTP request an toàn (User-Agent rotation, Exponential Backoff, Jitter)
- Đọc/ghi JSON an toàn với bản sao lưu và atomic write
- Bộ lọc nhận diện sầu riêng theo tiêu đề và nội dung
- Phân tích chuỗi thời gian tương đối
"""

import os
import json
import time
import re
import random
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

# Cấu hình đường dẫn dự án
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "public" / "data"
CHANNELS_FILE = DATA_DIR / "channels.json"
PROCESSED_FILE = DATA_DIR / "processed_videos.json"
HISTORY_FILE = DATA_DIR / "history.json"
LATEST_FILE = DATA_DIR / "latest.json"
SOURCES_DIR = DATA_DIR / "sources"
ENV_FILE = ROOT_DIR / ".env"

# Tự động nạp file .env nếu có (dành cho chạy local)
if ENV_FILE.exists():
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    _k, _v = _k.strip(), _v.strip().strip('"').strip("'")
                    if _k and not os.getenv(_k):
                        os.environ[_k] = _v
    except Exception:
        pass

# Múi giờ Việt Nam (UTC+7)
VN_TZ = timezone(timedelta(hours=7))

# Pool User-Agent chuẩn từ các trình duyệt phổ biến
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
]

# Từ khóa nhận diện sầu riêng trước khi gọi AI (tiết kiệm Quota & Token)
DURIAN_KEYWORDS = [
    "sầu riêng", "sau rieng", "ri6", "ri 6", "di 6", "zi 6",
    "monthong", "mỏn thon", "mon thong", "thái", "dona",
    "musang", "mút sang", "black thorn", "gai đen", "chuồng bò", "sáu hữu",
    "báo giá", "giá xô", "cắt xô", "tại vườn"
]

# Regex lọc nghiêm ngặt tiêu đề: BẮT BUỘC có cụm từ "sầu riêng" hoặc "sau rieng" (hỗ trợ mọi biến thể dấu & hoa/thường)
DURIAN_TITLE_REGEX = re.compile(r"s[aàảãáạăằẳẵắặâầẩẫấậ]u\s*ri[eèẻẽéẹêềểễếệ]ng", re.IGNORECASE)


def get_safe_headers():
    """Tạo headers giả lập trình duyệt thật, xoay vòng User-Agent."""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
    }


def safe_sleep(min_sec: float = 3.0, max_sec: float = 6.0, msg: str = ""):
    """Tạm dừng ngẫu nhiên kèm Jitter để tránh bị phát hiện bot."""
    duration = round(random.uniform(min_sec, max_sec), 2)
    if msg:
        print(f"       -> [An toàn] Tạm dừng {duration}s ({msg})...")
    time.sleep(duration)


def safe_requests_get(url: str, timeout: int = 15, max_retries: int = 3):
    """Gửi HTTP request với cơ chế Exponential Backoff & Retry an toàn."""
    for attempt in range(1, max_retries + 1):
        try:
            headers = get_safe_headers()
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code == 429:
                wait_time = attempt * 8 + random.uniform(1, 4)
                print(f"[CẢNH BÁO] Gặp 429 Rate Limit. Tự động chờ {wait_time:.1f}s trước khi thử lại (lần {attempt}/{max_retries})...")
                time.sleep(wait_time)
                continue
            return resp
        except Exception as e:
            if attempt == max_retries:
                print(f"[ERR] Thất bại sau {max_retries} lần thử: {e}")
                return None
            wait_time = attempt * 3 + random.uniform(1, 2)
            time.sleep(wait_time)
    return None


def is_durian_title(title: str) -> bool:
    """
    Lọc nghiêm ngặt: Tiêu đề video BẮT BUỘC phải chứa chữ 'sầu riêng' hoặc 'sau rieng'
    (chấp nhận mọi biến thể có dấu/không dấu/hoa/thường). Tuyệt đối bỏ qua video mít, ớt, phân bón.
    """
    if not title:
        return False
    return bool(DURIAN_TITLE_REGEX.search(title))


def has_durian_content(title: str, transcript: str = "") -> bool:
    """Lọc video có nội dung sầu riêng: Tiêu đề BẮT BUỘC có 'sầu riêng' / 'sau rieng'."""
    if not is_durian_title(title):
        return False
    if not transcript:
        return True
    content = transcript[:3000].lower()
    return any(kw in content for kw in DURIAN_KEYWORDS)


def load_json(file_path: Path, default):
    """Đọc dữ liệu từ file JSON an toàn."""
    if not file_path.exists():
        return default
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Lỗi đọc file {file_path}: {e}")
        return default


def save_json(file_path: Path, data):
    """Ghi file JSON an toàn với bản sao lưu và atomic write."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    # 1. Tạo bản sao lưu an toàn trong .cache/backups/ (không làm rác public/ hay Git)
    if file_path.exists():
        backup_dir = ROOT_DIR / ".cache" / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_file = backup_dir / f"{file_path.name}.bak"
        try:
            shutil.copy2(file_path, backup_file)
        except Exception:
            pass

    # 2. Ghi ra file tạm rồi atomic rename để chống hỏng file
    temp_file = file_path.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    temp_file.replace(file_path)


def save_split_data(history_data: dict):
    """
    Triển khai kiến trúc 2 tầng (Two-Tier Data) & Tách nguồn theo ngày:
    1. Lưu từng ngày vào public/data/sources/{date}.json (chứa mảng sources chi tiết)
    2. Lưu public/data/latest.json (siêu nhẹ ~15-25KB, chứa 35 ngày giá gần nhất + sources của ngày mới nhất)
    3. Lưu public/data/history.json (lịch sử toàn bộ các ngày)
    """
    if not isinstance(history_data, dict) or "days" not in history_data:
        save_json(HISTORY_FILE, history_data)
        return

    # 1. Tạo thư mục sources nếu chưa có
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)

    raw_days_dict = history_data.get("days", {})
    # Làm sạch: Chỉ giữ lại các ngày có định dạng YYYY-MM-DD hợp lệ và năm hợp lý
    now_year = datetime.now().year
    days_dict = {}
    for day_str, day_content in raw_days_dict.items():
        try:
            parts = day_str.split("-")
            if len(parts) == 3 and len(parts[0]) == 4:
                year = int(parts[0])
                if not (now_year - 2 <= year <= now_year + 1):
                    print(f"[CẢNH BÁO] Loại bỏ ngày có năm bất thường khỏi database: {day_str}")
                    continue
                datetime(year, int(parts[1]), int(parts[2]))
                days_dict[day_str] = day_content
            else:
                print(f"[CẢNH BÁO] Loại bỏ ngày không hợp lệ khỏi database: {day_str}")
        except (ValueError, TypeError):
            print(f"[CẢNH BÁO] Loại bỏ ngày không hợp lệ khỏi database: {day_str}")

    # Tự động bù by_region nếu ngày có dữ liệu nhưng chưa được tính giá khu vực
    try:
        try:
            from price_calculator import calculate_regional_data
        except ImportError:
            from scripts.price_calculator import calculate_regional_data
        for day_str, day_content in days_dict.items():
            by_reg = day_content.get("by_region")
            if not by_reg or not any(by_reg.get(k) for k in ["mientay", "miendong", "taynguyen"]):
                srcs = day_content.get("sources", [])
                daily_avg = day_content.get("daily_average", {})
                if daily_avg:
                    day_content["by_region"] = calculate_regional_data(srcs, daily_avg)
    except Exception as e:
        print(f"[CẢNH BÁO] Lỗi khi tự động tính giá vùng miền: {e}")

    history_data["days"] = days_dict
    sorted_days = sorted(days_dict.keys(), reverse=True)

    # Lưu chi tiết nguồn tin từng ngày vào thư mục sources/
    for day_str, day_content in days_dict.items():
        sources = day_content.get("sources", [])
        source_file = SOURCES_DIR / f"{day_str}.json"
        save_json(source_file, sources)

    # 2. Xây dựng latest.json (35 ngày gần nhất để web tải siêu nhanh)
    latest_day = sorted_days[0] if sorted_days else None
    recent_day_keys = sorted_days[:35]  # Lấy 35 ngày gần nhất cho so sánh T-30 và vẽ biểu đồ 1 tháng
    recent_days_data = {}
    for d in recent_day_keys:
        srcs = days_dict[d].get("sources", [])
        recent_days_data[d] = {
            "daily_average": days_dict[d].get("daily_average", {}),
            "by_region": days_dict[d].get("by_region", {}),
            "source_count": len(srcs),
            # Kèm nguồn cho ngày mới nhất để trang chủ render ngay lập tức không cần fetch thêm
            "sources": srcs if d == latest_day else []
        }

    latest_data = {
        "last_updated": history_data.get("last_updated", ""),
        "latest_day": latest_day,
        "available_days": sorted_days,
        "days": recent_days_data,
        "is_partial": len(sorted_days) > len(recent_day_keys)
    }
    save_json(LATEST_FILE, latest_data)

    # 3. Lưu toàn bộ history.json
    save_json(HISTORY_FILE, history_data)


def parse_relative_time(time_str: str) -> datetime:
    """
    Chuyển đổi chuỗi thời gian tương đối (vd: '42 phút trước', '18 giờ trước', '1 ngày trước')
    thành datetime UTC.
    """
    now = datetime.now(timezone.utc)
    if not time_str:
        return now

    s = time_str.lower().strip()
    match = re.search(r"(\d+)", s)
    if not match:
        return now

    val = int(match.group(1))
    if "giây" in s or "second" in s:
        return now - timedelta(seconds=val)
    if "phút" in s or "minute" in s:
        return now - timedelta(minutes=val)
    if "giờ" in s or "hour" in s:
        return now - timedelta(hours=val)
    if "ngày" in s or "day" in s:
        return now - timedelta(days=val)
    if "tuần" in s or "week" in s:
        return now - timedelta(weeks=val)
    if "tháng" in s or "month" in s:
        return now - timedelta(days=val * 30)
    if "năm" in s or "year" in s:
        return now - timedelta(days=val * 365)

    return now
