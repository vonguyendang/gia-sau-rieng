# ☁️ Hướng Dẫn Triển Khai Toàn Diện (Deployment Guide)

Dự án **Gia Sau Rieng Tracker** được thiết kế theo kiến trúc **Serverless 100% Miễn Phí**:
1. **GitHub Actions:** Tự động chạy script cào giá và commit dữ liệu định kỳ mỗi 3 tiếng.
2. **Cloudflare Pages:** Hosting website tĩnh toàn cầu tốc độ cao, tự động deploy mỗi khi có commit mới.

---

## 🤖 Phần 1: Cấu Hình GitHub Actions (Tự Động Hóa 24/7)

### Bước 1: Thêm `GEMINI_API_KEY` vào GitHub Secrets

1. Mở repository dự án trên GitHub: [https://github.com/vonguyendang/gia-sau-rieng](https://github.com/vonguyendang/gia-sau-rieng).
2. Vào tab **Settings** (ở thanh menu phía trên của repository).
3. Tại menu bên trái, tìm mục **Security** $\rightarrow$ chọn **Secrets and variables** $\rightarrow$ **Actions**.
4. Nhấn nút xanh **New repository secret**.
5. Nhập các thông tin sau:
   * **Name:** `GEMINI_API_KEY` *(bắt buộc viết hoa chính xác)*
   * **Secret:** Dán mã API Key bạn đã lấy từ Google AI Studio (`AIzaSy...`).
6. Nhấn **Add secret** để lưu.

---

### Bước 2: Cấp Quyền Ghi Cho GitHub Actions Bot

GitHub Actions cần quyền ghi (`write permissions`) để tự động commit file dữ liệu `history.json` và `processed_videos.json` vào nhánh `main`.

1. Vẫn trong trang **Settings** của repository:
2. Tại menu bên trái, tìm mục **Code and automation** $\rightarrow$ chọn **Actions** $\rightarrow$ **General**.
3. Cuộn xuống phần **Workflow permissions** (ở gần cuối trang):
   * Chọn tùy chọn: **Read and write permissions**.
   * Đánh dấu tích vào ô: **Allow GitHub Actions to create and approve pull requests**.
4. Nhấn nút **Save**.

---

### Bước 3: Kiểm Tra Hoặc Kích Hoạt Thủ Công Workflow

* **Lịch chạy tự động:** Workflow `fetch_prices.yml` được cấu hình chạy tự động mỗi 3 tiếng:
  `cron: '0 */3 * * *'` (theo giờ UTC).
* **Kích hoạt thủ công ngay lập tức:**
  1. Vào tab **Actions** trên repository GitHub.
  2. Tại danh sách bên trái, chọn **Auto Fetch Durian Prices**.
  3. Nhấn vào menu xổ xuống **Run workflow** $\rightarrow$ Nhấn nút xanh **Run workflow**.
  4. Quá trình chạy sẽ mất khoảng 1 - 2 phút. Sau khi chạy xong với biểu tượng tick xanh, kiểm tra commit mới nhất trên nhánh `main` sẽ thấy dữ liệu giá đã được tự động cập nhật!

---

## ⚡ Phần 2: Triển Khai Website Lên Cloudflare Pages

Cloudflare Pages là giải pháp hosting web tĩnh hàng đầu thế giới với mạng lưới CDN hơn 300 thành phố, băng thông không giới hạn và hoàn toàn miễn phí.

### Bước 1: Kết Nối Repository Với Cloudflare

1. Đăng nhập vào trang quản trị **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Tại menu bên trái, chọn **Workers & Pages** $\rightarrow$ chọn tab **Pages**.
3. Nhấn nút **Connect to Git** (hoặc **Create application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to Git**).
4. Cấp quyền cho Cloudflare truy cập tài khoản GitHub của bạn và chọn repository `gia-sau-rieng`.
5. Nhấn **Begin setup**.

---

### Bước 2: Thiết Lập Cấu Hình Build (Build Settings)

Tại màn hình cấu hình, điền chính xác các thông số:

| Cấu Hình | Giá Trị Điền | Giải Thích |
| :--- | :--- | :--- |
| **Project name** | `gia-sau-rieng` *(tùy chọn)* | Tên project trên Cloudflare |
| **Production branch** | `main` | Nhánh chứa mã nguồn chính thức |
| **Framework preset** | **None** | Website tĩnh thuần HTML/JS |
| **Build command** | *(Để trống hoàn toàn)* | Không cần lệnh build (không dùng Node.js) |
| **Build output directory** | `public` | Thư mục chứa `index.html`, `app.js` và `data/` |
| **Root directory** | `/` *(hoặc để trống)* | Thư mục gốc |

Nhấn **Save and Deploy**.

---

### Bước 3: Hoàn Tất & Kiểm Tra Tên Miền

* Sau khoảng 15 đến 30 giây, Cloudflare Pages sẽ báo deploy thành công kèm theo đường link truy cập dạng:
  👉 `https://gia-sau-rieng.pages.dev`
* **Cơ chế cập nhật tự động:**
  Mỗi khi GitHub Actions hoàn thành việc thu thập dữ liệu và commit file `history.json` mới lên nhánh `main`, Cloudflare Pages sẽ lập tức nhận webhook và tái triển khai trang web trong vòng chưa đầy 10 giây!

---

### Bước 4 (Tùy Chọn): Gắn Tên Miền Riêng (Custom Domain)

Nếu bạn sở hữu tên miền riêng (ví dụ: `giasaurieng.vn` hoặc `gia-sr.com`):
1. Trong dashboard của Cloudflare Pages, chọn project vừa tạo $\rightarrow$ tab **Custom domains**.
2. Nhấn **Set up a custom domain** và nhập tên miền của bạn.
3. Làm theo hướng dẫn trỏ bản ghi CNAME hoặc DNS. Cloudflare sẽ tự động kích hoạt chứng chỉ bảo mật **SSL / HTTPS miễn phí**.
