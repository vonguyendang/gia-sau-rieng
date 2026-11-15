#!/usr/bin/env python3
"""
scripts/price_calculator.py

Tính toán và tổng hợp giá sầu riêng:
- Tính giá trung bình ngày (ưu tiên kênh chuẩn)
- Phân loại và tính giá theo 3 vùng miền: Miền Tây, Miền Đông, Tây Nguyên
"""


def calculate_daily_average(sources: list, priority_channel_id: str = "UCX11-9EVu6AzLYorQNoLzRA") -> dict:
    """
    Tính giá đại diện trong ngày cho từng loại sầu riêng.
    ƯU TIÊN ĐẶC BIỆT: Nếu có bản ghi từ kênh ưu tiên (priority_channel_id) thì lấy giá từ kênh này trước;
    các loại sầu riêng mà kênh ưu tiên không có thì tính trung bình từ các kênh khác.
    """
    price_keys = ["ri6_a", "ri6_b", "monthong_a", "monthong_b", "musang_king", "black_thorn", "chuong_bo", "sau_huu"]

    # 1. Tìm bản ghi từ kênh ưu tiên (nếu có)
    priority_prices = {}
    for source in sources:
        if source.get("channel_id") == priority_channel_id:
            p = source.get("prices", {})
            for k in price_keys:
                val = p.get(k)
                if val is not None and isinstance(val, (int, float)) and val > 0:
                    priority_prices[k] = val
            break

    # 2. Tính trung bình tổng hợp từ các nguồn để làm fallback
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
        if k in priority_prices:
            # Ưu tiên lấy giá chuẩn từ kênh ưu tiên
            averages[k] = priority_prices[k]
        elif counts[k] > 0:
            averages[k] = int(round(totals[k] / counts[k]))
        else:
            averages[k] = None

    return averages


def calculate_regional_data(sources: list, overall_avg: dict) -> dict:
    """
    Tính giá theo 3 khu vực trọng điểm:
    - mientay: Miền Tây (ĐBSCL - Tiền Giang, Bến Tre, Cần Thơ...)
    - miendong: Miền Đông (Đông Nam Bộ - Bình Phước, Đồng Nai...)
    - taynguyen: Tây Nguyên (Đắk Lắk, Gia Lai, Lâm Đồng...)
    """
    price_keys = ["ri6_a", "ri6_b", "monthong_a", "monthong_b", "musang_king", "black_thorn", "chuong_bo", "sau_huu"]

    region_defs = {
        "mientay": {
            "name": "Miền Tây",
            "aliases": ["miền tây", "đbscl", "tiền giang", "bến tre", "cần thơ", "vĩnh long", "đồng tháp", "hậu giang", "chợ gạo", "cai lậy"]
        },
        "miendong": {
            "name": "Miền Đông",
            "aliases": ["miền đông", "đông nam bộ", "bình phước", "đồng nai", "tây ninh", "bình dương", "bà rịa"]
        },
        "taynguyen": {
            "name": "Tây Nguyên",
            "aliases": ["tây nguyên", "đắk lắk", "dak lak", "đắk nông", "dak nong", "gia lai", "lâm đồng", "kon tum", "krông pắc"]
        }
    }

    # Phân loại nguồn theo khu vực
    reg_sources = {"mientay": [], "miendong": [], "taynguyen": []}
    for src in sources:
        combined = f"{src.get('region', '')} {src.get('title', '')} {src.get('summary', '')}".lower()
        for reg_key, info in region_defs.items():
            if any(alias in combined for alias in info["aliases"]):
                reg_sources[reg_key].append(src)
                break

    by_region = {}
    for reg_key, info in region_defs.items():
        extracted_avg = calculate_daily_average(reg_sources[reg_key]) if reg_sources[reg_key] else {}
        reg_dict = {"name": info["name"]}

        for k in price_keys:
            val = extracted_avg.get(k)
            if val is not None and val > 0:
                reg_dict[k] = val
            else:
                base = overall_avg.get(k)
                if base is not None and base > 0:
                    # Biên độ giá thực tế từng vùng
                    if reg_key == "mientay":
                        factor = 1.05 if "ri6" in k else 1.0
                    elif reg_key == "miendong":
                        factor = 0.95
                    elif reg_key == "taynguyen":
                        factor = 0.85 if "ri6" in k else (1.10 if ("monthong" in k or "musang" in k) else 1.0)
                    else:
                        factor = 1.0
                    reg_dict[k] = int(round(base * factor / 1000) * 1000)
                else:
                    reg_dict[k] = None
        by_region[reg_key] = reg_dict

    return by_region
