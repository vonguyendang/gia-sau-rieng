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

* **Lịch chạy tự động:** Workflow `update_prices.yml` được cấu hình chạy tự động 3 lần/ngày đúng các khung giờ thương lái đăng giá:
  `cron: '30 4,6,11 * * *'` (tương ứng **11h30**, **13h30** và **18h30** giờ Việt Nam).
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

---

## ⏱️ Phần 3: Cấu Hình Chạy Tự Động Chuẩn Từng Giây Qua Cron-job.org (Triệt Tiêu 100% Delay)

### Tại sao nên dùng Cron-job.org kết hợp GitHub Actions?

* Tính năng `schedule` mặc định của GitHub Actions thường xuyên bị trễ hàng đợi từ 30 phút đến vài tiếng (do hàng triệu workflow toàn cầu cùng tranh giành máy chủ ảo).
* Ngược lại, lệnh gọi API **`workflow_dispatch`** luôn được GitHub ưu tiên cấp máy chủ và chạy **ngay lập tức trong vòng 5 – 10 giây**.
* **[cron-job.org](https://cron-job.org/)** là dịch vụ hẹn giờ miễn phí, ổn định và chính xác đến từng giây. Dịch vụ này sẽ đóng vai trò người "bấm nút hộ bạn" đúng vào các khung giờ vàng trong ngày.

---

### Bước 1: Tạo GitHub Personal Access Token (PAT)

1. Mở trang quản lý token trên GitHub: [https://github.com/settings/tokens](https://github.com/settings/tokens).
2. Nhấn nút **Generate new token** $\rightarrow$ Chọn **Generate new token (classic)**.
3. Điền các thông tin:
   * **Note:** `Cronjob Price Tracker`
   * **Expiration:** Chọn `No expiration` (hoặc thời hạn tùy bạn muốn).
   * **Select scopes (Phân quyền):** Tích chọn 2 ô sau:
     * ✅ **`repo`** *(Full control of private repositories - Toàn quyền thao tác kho lưu trữ)*
     * ✅ **`workflow`** *(Update GitHub Action workflows - Quyền kích hoạt chạy tiến trình)*
4. Cuộn xuống cuối trang và nhấn nút xanh **Generate token**.
5. **Sao chép và lưu lại mã token vừa tạo** (có dạng `ghp_xxxxxxxxxxxxxxxxxxxx`).  
   *(Lưu ý: Mã này chỉ hiển thị một lần duy nhất, hãy lưu vào nơi an toàn).*

---

### Bước 2: Tạo Lịch Hẹn Trên Cron-job.org

1. Truy cập [https://cron-job.org/](https://cron-job.org/) và đăng ký/đăng nhập tài khoản miễn phí.
2. Tại bảng điều khiển (Dashboard), nhấn nút **Create Cronjob** và điền theo bảng sau:

| Trường Thông Tin | Giá Trị Cần Điền | Ghi Chú |
| :--- | :--- | :--- |
| **Title** | `Cập nhật giá sầu riêng tự động` | Tên gợi nhớ |
| **URL** | `https://api.github.com/repos/vonguyendang/gia-sau-rieng/actions/workflows/update_prices.yml/dispatches` | Endpoint API kích hoạt workflow |
| **Execution schedule** | Chọn **User-defined** (hoặc Custom) | Chọn chạy vào **11:35**, **13:35**, **18:35** hàng ngày |
| **Timezone** | `Asia/Bangkok` hoặc `Asia/Ho_Chi_Minh` | Múi giờ Việt Nam (UTC+7) |
| **Request Method** | Chọn **POST** | Bắt buộc chọn POST |

3. Kéo xuống mục **Advanced Settings** (Cài đặt nâng cao):
   * **Headers:** Thêm 3 dòng sau:
     * Header 1: Key = `Accept`, Value = `application/vnd.github.v3+json`
     * Header 2: Key = `Authorization`, Value = `Bearer ghp_MÃ_TOKEN_CỦA_BẠN` *(thay `ghp_...` bằng token đã copy ở Bước 1)*
     * Header 3: Key = `User-Agent`, Value = `Durian-Tracker`
   * **Request Body:** Điền chính xác chuỗi JSON sau:
     ```json
     {"ref": "main"}
     ```
4. Nhấn **Create** để lưu cronjob.

---

### Bước 3: Kiểm Tra Thử Nghiệm Ngay Lập Tức

1. Trong danh sách Cronjob trên `cron-job.org`, tìm dòng vừa tạo và nhấn vào biểu tượng **Chạy thử (Run now / Test)**.
2. Kiểm tra cột kết quả:
   * Nếu hiện **Status: 204 No Content** (hoặc `204 OK`) màu xanh $\rightarrow$ **Cấu hình thành công 100%!**
3. Mở tab **Actions** trên GitHub: Bạn sẽ thấy ngay lập tức một tiến trình **"Cập nhật giá sầu riêng tự động"** đang quay vòng vàng chạy tức thì mà không hề bị delay!

---

### Bước 4 (Tùy Chọn): Tạo Thêm Cronjob Cho Tiến Trình Cào Lùi Lịch Sử (Backfill)

Bạn có thể tạo thêm một cronjob thứ hai cho tác vụ tích lũy lịch sử:
* **URL:** `https://api.github.com/repos/vonguyendang/gia-sau-rieng/actions/workflows/backfill_history.yml/dispatches`
* **Lịch chạy:** 1 lần/ngày lúc `02:15` sáng.
* **Headers & Body:** Tương tự như trên.


