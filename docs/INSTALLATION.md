# 🛠️ Hướng Dẫn Cài Đặt Chi Tiết (Installation Guide)

Tài liệu này cung cấp hướng dẫn từng bước để cài đặt, cấu hình và chạy dự án **Gia Sau Rieng Tracker** tại môi trường máy tính cá nhân (Local Development) trên các hệ điều hành: **macOS**, **Linux**, và **Windows**.

---

## 📋 1. Yêu Cầu Hệ Thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:

* **Git:** Phiên bản 2.30 trở lên. ([Tải Git](https://git-scm.com/))
* **Python:** Phiên bản **Python 3.10** hoặc mới hơn (khuyên dùng Python 3.11 hoặc 3.12). ([Tải Python](https://www.python.org/downloads/))
* **Trình duyệt web:** Chrome, Edge, Safari hoặc Firefox.
* **Google Gemini API Key:** Lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/).

Kiểm tra phiên bản trong Terminal / Command Prompt:
```bash
git --version
python3 --version  # Trên Windows có thể là: python --version
pip3 --version     # Trên Windows có thể là: pip --version
```

---

## 📥 2. Tải Mã Nguồn (Clone Repository)

Mở terminal và thực hiện clone dự án từ GitHub:

```bash
git clone https://github.com/vonguyendang/gia-sau-rieng.git
cd gia-sau-rieng
```

---

## 🐍 3. Thiết Lập Môi Trường Ảo Python (Virtual Environment)

Khuyến nghị sử dụng môi trường ảo (`venv`) để tránh xung đột thư viện với hệ thống:

### Trên macOS / Linux:
```bash
# Tạo môi trường ảo tên .venv
python3 -m venv .venv

# Kích hoạt môi trường ảo
source .venv/bin/activate
```

### Trên Windows (Command Prompt hoặc PowerShell):
```cmd
:: Tạo môi trường ảo
python -m venv .venv

:: Kích hoạt trên Command Prompt (CMD)
.venv\Scripts\activate.bat

:: Hoặc kích hoạt trên PowerShell
.venv\Scripts\Activate.ps1
```

*(Khi kích hoạt thành công, bạn sẽ thấy tiền tố `(.venv)` xuất hiện ở đầu dòng lệnh).*

---

## 📦 4. Cài Đặt Các Gói Thư Viện (Dependencies)

Cài đặt toàn bộ các thư viện cần thiết đã được định nghĩa trong `scripts/requirements.txt`:

```bash
pip install -r scripts/requirements.txt
```

Các gói chính bao gồm:
* `requests`: Gọi HTTP request tải dữ liệu kênh.
* `feedparser`: Đọc dữ liệu video từ YouTube RSS Feed.
* `youtube-transcript-api`: Trích xuất phụ đề tiếng Việt tự động từ video YouTube.
* `google-genai`: Thư viện chính thức từ Google kết nối với Gemini AI.
* `python-dotenv`: Nạp biến môi trường từ file `.env`.

---

## 🔑 5. Cấu Hình Biến Môi Trường (`.env`)

1. Sao chép file mẫu `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Trên Windows: `copy .env.example .env`)*

2. Mở file `.env` bằng trình soạn thảo và điền API Key của bạn:
   ```env
   # Google Gemini API Key (Lấy tại https://aistudio.google.com/)
   GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere

   # Model Gemini sử dụng (Mặc định: gemini-3.8-flash)
   GEMINI_MODEL=gemini-3.8-flash
   ```

> [!TIP]
> **Cách lấy Gemini API Key miễn phí:**
> 1. Truy cập [https://aistudio.google.com/](https://aistudio.google.com/) và đăng nhập Google.
> 2. Chọn **"Get API key"** $\rightarrow$ **"Create API key"**.
> 3. Sao chép khóa bí mật và dán vào file `.env`.

---

## 🚀 6. Chạy Thử Nghiệm Thu Thập Dữ Liệu (Data Fetching)

Sau khi cấu hình xong API Key, bạn có thể chạy script để quét các video báo giá sầu riêng mới nhất:

```bash
python3 scripts/fetch_prices.py
```

Quy trình tự động diễn ra:
1. Đọc danh sách kênh trong `public/data/channels.json` (ưu tiên kênh `@julitore18`).
2. Quét các video được đăng tải trong vòng 48 giờ qua.
3. Trích xuất phụ đề tiếng Việt tự động.
4. Gửi nội dung phụ đề cho **Gemini 3.8 Flash** trích xuất khoảng giá xô tại vườn (Min - Max).
5. Tự động tính toán trung bình ngày và cập nhật vào `public/data/history.json`.

---

## 🌐 7. Khởi Chạy Giao Diện Web Cục Bộ (Local Preview)

Dự án là ứng dụng Web tĩnh (Static Site) thuần HTML/JS, không cần cài đặt Node.js hay build code. Bạn có thể mở trực tiếp thông qua module HTTP server tích hợp sẵn của Python:

```bash
# Chạy HTTP Server trên cổng 5050 (tránh xung đột cổng 8080)
python3 -m http.server 5050 --directory public
```

Mở trình duyệt web và truy cập địa chỉ:
👉 **[http://localhost:5050](http://localhost:5050)**

Bạn sẽ thấy:
* **Bảng 6 Thẻ Giá Xô Tại Vườn:** Ri6 (Min - Max), Thái Monthong (Min - Max), Musang King, Black Thorn, Chuồng Bò, Sáu Hữu.
* **Biểu Đồ Xu Hướng Giá:** Tương tác mượt mà, lọc theo 7 ngày, 30 ngày hoặc tất cả.
* **Bảng Đối Chiếu Cùng Kỳ:** Tự động so sánh với Hôm qua ($T-1$), Tuần trước ($T-7$), Tháng trước ($T-30$) và Năm ngoái ($\text{YoY}$).
* **Chi Tiết Nguồn Tin:** Danh sách video gốc kèm tóm tắt thị trường bằng AI.

---

## ⏪ 8. Cào Lùi Dữ Liệu Lịch Sử (Backfill History)

Nếu muốn thu thập thêm các video trong quá khứ để làm dày thêm biểu đồ:

```bash
# Quét lùi tối đa 10 video sầu riêng cũ của mỗi kênh
python3 scripts/backfill_history.py
```

Script có thiết lập cơ chế nghỉ (`sleep`) an toàn giữa các video để tránh chạm ngưỡng giới hạn tần suất (Rate Limit) của YouTube và Gemini API.

---

## ❓ 9. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Vấn Đề | Nguyên Nhân | Cách Khắc Phục |
| :--- | :--- | :--- |
| **`404 NOT_FOUND` khi gọi Gemini** | API Key mới yêu cầu model `gemini-3.8-flash` thay vì model cũ `gemini-2.5-flash` | Kiểm tra file `.env` đã đặt `GEMINI_MODEL=gemini-3.8-flash`. |
| **`Address already in use` khi bật server** | Cổng mạng (ví dụ 8080 hoặc 5050) đang bị chiếm dụng bởi ứng dụng khác | Đổi sang cổng khác, ví dụ: `python3 -m http.server 5055 --directory public`. |
| **Không lấy được phụ đề YouTube** | Video không có phụ đề tiếng Việt hoặc YouTube chặn IP do gửi request quá nhanh | Script sẽ tự động ghi nhận và bỏ qua video này, không làm crash toàn bộ tiến trình. |
| **Biểu đồ hiển thị trống** | File `public/data/history.json` chưa có dữ liệu hoặc bị lỗi cú pháp | Chạy lại `python3 scripts/fetch_prices.py` để tạo dữ liệu mới. |

