# 🍈 Giá Sầu Riêng Tracker (`gia-sau-rieng`)

> Hệ thống tự động thu thập, phân tích và theo dõi biến động **giá sầu riêng cắt xô tại vườn** hàng ngày từ các kênh YouTube uy tín tại Miền Tây & Tây Nguyên (ưu tiên kênh `@julitore18`).
> **100% Serverless & Hoàn Toàn Miễn Phí** thông qua **GitHub Actions**, **Google Gemini AI**, và **Cloudflare Pages**.

[![Auto Fetch Prices](https://github.com/vonguyendang/gia-sau-rieng/actions/workflows/fetch_prices.yml/badge.svg)](https://github.com/vonguyendang/gia-sau-rieng/actions/workflows/fetch_prices.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Tính Năng Nổi Bật

* 🍈 **Theo dõi 6 giống sầu riêng chuẩn theo thứ tự thị trường:**
  1. **Sầu riêng Ri6** (Khoảng giá xô: Min – Max, ví dụ 48k – 53k đ/kg)
  2. **Sầu riêng Thái (Monthong / Dona)** (Khoảng giá xô: Min – Max, ví dụ 70k – 75k đ/kg)
  3. **Sầu riêng Musang King**
  4. **Sầu riêng Black Thorn (Gai Đen)**
  5. **Sầu riêng Chuồng Bò**
  6. **Sầu riêng Sáu Hữu**
* ⚖️ **Quy chuẩn giá xô nguyên vườn (Farm-gate Bulk Price):**
  Hiển thị đúng khoảng giá cắt xô (Min – Max) theo tỉ lệ phân loại trái (8:2, 7:3), không tự ý phân loại thành giá bán lẻ từng trái A hay B.
* 📈 **Bảng đối chiếu giá so với cùng kỳ:**
  Tự động so sánh biến động hôm nay với **Hôm qua ($T-1$)**, **Tuần trước ($T-7$)**, **Tháng trước ($T-30$)**, và **Cùng kỳ năm trước ($\text{YoY}$)**.
* ⏱ **Cập nhật tự động theo khung giờ vàng:** GitHub Actions tự động quét video 3 lần/ngày (11h30, 13h30, 18h30 đúng các thời điểm thương lái và vựa chốt giá), không tốn server riêng.
* 🧹 **Tự động dọn dẹp lịch sử Workflow:** Tự động xóa các log/run cũ tích tụ qua thời gian, giữ repository luôn nhẹ nhàng và sạch sẽ.
* 🧠 **Trích xuất thông minh bằng Gemini:** Tự động lấy phụ đề tiếng Việt qua `youtube-transcript-api` và phân tích khoảng giá chuẩn xác.
* 📊 **Giao diện hiện đại & không cần build:** Viết bằng HTML5 thuần, Tailwind CSS và Chart.js, deploy tức thì lên Cloudflare Pages.

---

## 📚 Tài Liệu Hướng Dẫn Chi Tiết (Documentation)

* 📖 **[Hướng dẫn cài đặt chi tiết trên máy tính (Local Installation Guide)](docs/INSTALLATION.md)**
* ☁️ **[Hướng dẫn triển khai CI/CD GitHub Actions & Cloudflare Pages](docs/DEPLOYMENT.md)**
* ⏱️ **[Hướng dẫn cấu hình Cron-job.org chạy tự động chuẩn xác từng giây (0% Delay)](docs/DEPLOYMENT.md#-phần-3-cấu-hình-chạy-tự-động-chuẩn-từng-giây-qua-cron-joborg-triệt-tiêu-100-delay)**
* 🛡️ **[Cấu hình & Cơ chế cào dữ liệu an toàn (Safe Scraping Architecture)](docs/SAFE_SCRAPING.md)**

---

## ⚡ Hướng Dẫn Cài Đặt Nhanh (Quickstart)

### 1. Clone mã nguồn
```bash
git clone https://github.com/vonguyendang/gia-sau-rieng.git
cd gia-sau-rieng
```

### 2. Thiết lập môi trường ảo & cài đặt thư viện
```bash
# Tạo và kích hoạt môi trường ảo
python3 -m venv .venv
source .venv/bin/activate  # Trên Windows: .venv\Scripts\activate

# Cài đặt thư viện
pip install -r scripts/requirements.txt
```

### 3. Cấu hình file `.env`
Sao chép `.env.example` thành `.env` và điền Gemini API Key của bạn:
```bash
cp .env.example .env
```
Nội dung file `.env`:
```env
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
GEMINI_MODEL=gemini-3.8-flash
```
*(Lấy API Key hoàn toàn miễn phí tại [Google AI Studio](https://aistudio.google.com/)).*

### 4. Chạy thử nghiệm cào giá
```bash
python3 scripts/fetch_prices.py
```

### 5. Mở giao diện xem thử (Local Preview)
```bash
python3 -m http.server 5050 --directory public
```
Truy cập trình duyệt: **`http://localhost:5050`**

---

## 📁 Cấu Trúc Thư Mục

```text
gia-sau-rieng/
├── .github/
│   └── workflows/
│       ├── update_prices.yml      # Tự động quét giá theo khung giờ vàng & commit kết quả
│       ├── backfill_history.yml   # Cào lùi video lịch sử tích lũy tự động / thủ công
│       └── cleanup_workflows.yml  # Tự động dọn dẹp lịch sử các workflow runs cũ (hỗ trợ gọi API)
├── docs/
│   ├── INSTALLATION.md            # Hướng dẫn cài đặt chi tiết các hệ điều hành
│   └── DEPLOYMENT.md              # Hướng dẫn triển khai GitHub Actions & Cloudflare Pages
├── scripts/
│   ├── fetch_prices.py            # Script cào giá chính: RSS -> Transcript -> Gemini -> JSON
│   ├── backfill_history.py        # Script cào lùi lịch sử an toàn với sleep timer
│   └── requirements.txt           # Thư viện Python cần thiết
├── public/                        # Thư mục web deploy lên Cloudflare Pages
│   ├── index.html                 # Giao diện chính responsive
│   ├── app.js                     # Logic hiển thị giá, Chart.js, đối chiếu cùng kỳ
│   └── data/
│       ├── channels.json          # Danh sách kênh YouTube (ưu tiên @julitore18)
│       ├── processed_videos.json  # Cache video đã xử lý
│       └── history.json           # Dữ liệu giá theo ngày (100% dữ liệu thật)
├── .env.example                   # File mẫu biến môi trường
└── README.md                      # Giới thiệu tổng quan
```

---

## 📄 Giấy Phép (License)

Dự án được phát hành theo giấy phép mã nguồn mở **MIT License**. Bạn được tự do sử dụng, chỉnh sửa và triển khai phục vụ cộng đồng nông nghiệp.
