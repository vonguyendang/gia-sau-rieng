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

Bạn có thể tạo theo 1 trong 2 cách sau:

#### Cách 1: Fine-grained Token (Bảo mật tối đa — Khuyên dùng)
1. Mở trang tạo token: [https://github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta) (hoặc vào **Settings** $\rightarrow$ **Developer Settings** $\rightarrow$ **Personal access tokens** $\rightarrow$ **Fine-grained tokens** $\rightarrow$ **Generate new token**).
2. Điền các trường cơ bản:
   * **Token name:** `Cronjob Price Tracker`
   * **Expiration:** Chọn `90 days` hoặc thời hạn bạn muốn.
3. **Tại mục Repository access (Quyền truy cập kho chứa):**
   * Đánh dấu chọn: **`Only select repositories`**.
   * Bấm nút **Select repositories** ngay bên dưới $\rightarrow$ Tìm và tích chọn đúng repo **`gia-sau-rieng`** (hoặc `vonguyendang/gia-sau-rieng`).
4. **Tại mục Permissions (Phân quyền):**
   * Nhấn mở rộng mục **Repository permissions**.
   * Tìm và cấp quyền **Read and write** cho 2 mục sau:
     * ✅ **Actions:** Chọn **`Read and write`** *(Bắt buộc — để kích hoạt chạy workflow qua API)*.
     * ✅ **Workflows:** Chọn **`Read and write`** *(Bắt buộc — để tương tác với các file workflow)*.
5. Cuộn xuống cuối trang nhấn nút xanh **Generate token** và **Sao chép mã token** (có dạng `github_pat_...`).

#### Cách 2: Classic Token (Truyền thống, thiết lập nhanh)
1. Mở: [https://github.com/settings/tokens](https://github.com/settings/tokens) $\rightarrow$ **Generate new token (classic)**.
2. Note: `Cronjob Price Tracker` $\rightarrow$ Expiration: `No expiration`.
3. Tích chọn 2 ô: ✅ **`repo`** và ✅ **`workflow`**.
4. Nhấn **Generate token** $\rightarrow$ **Sao chép mã token** (dạng `ghp_...`).

---

### Bước 2: Tạo 2 Lịch Hẹn Riêng Biệt Trên Cron-job.org

Dự án có **2 workflow độc lập**, bạn sẽ thực hiện bấm **Create Cronjob** 2 lần trên [cron-job.org](https://cron-job.org/):

#### 1️⃣ Cronjob 1: Cập nhật giá sầu riêng mới nhất hàng ngày

* **Title:** `Cập nhật giá sầu riêng hàng ngày`
* **URL:**  
  `https://api.github.com/repos/vonguyendang/gia-sau-rieng/actions/workflows/update_prices.yml/dispatches`
* **Execution schedule (Cấu hình 3 khung giờ trong ngày):**
  1. Tích chọn vào nút tròn **`Custom`** (nằm ở dòng cuối cùng trong mục Execution schedule).
  2. Tại ô **Crontab expression** ngay bên dưới, bạn điền chính xác biểu thức:
     ```
     35 11,13,18 * * *
     ```
     *(Ý nghĩa: Chạy vào phút thứ **35** của các giờ **11**, **13**, và **18** hàng ngày).*
  3. Quan sát cột bên phải mục **Next executions**, bạn sẽ thấy hệ thống tự động hiển thị danh sách các mốc chạy kế tiếp đúng chuẩn giờ Việt Nam:
     * `... 11:35 AM` (Trưa — giờ vựa chốt giá sáng)
     * `... 1:35 PM` (Đầu giờ chiều)
     * `... 6:35 PM` (Chiều tối — tổng kết thị trường cả ngày)
* **Timezone:** Kiểm tra đảm bảo đang là `Asia/Ho_Chi_Minh` hoặc `Asia/Bangkok` (GMT+7).
* **Request Method:** Chọn **`POST`**.
* **Headers (thêm 3 dòng trong mục tab ADVANCED phía trên):**
  * `Accept`: `application/vnd.github.v3+json`
  * `Authorization`: `Bearer MÃ_TOKEN_CỦA_BẠN` *(lưu ý: có chữ Bearer và 1 khoảng trắng trước mã token `ghp_...` hoặc `github_pat_...`)*
  * `User-Agent`: `Durian-Tracker`
* **Request Body:**
  ```json
  {"ref": "main"}
  ```
* Bấm nút màu cam **CREATE** (góc dưới bên phải) để lưu.

---

#### 2️⃣ Cronjob 2: Cào lùi dữ liệu lịch sử tự động (Backfill)

* **Title:** `Cào lùi dữ liệu lịch sử (Backfill)`
* **URL:**  
  `https://api.github.com/repos/vonguyendang/gia-sau-rieng/actions/workflows/backfill_history.yml/dispatches`
* **Execution schedule (Giờ chạy ban đêm):**
  * Cách 1: Tích chọn nút tròn **`Every day at`** $\rightarrow$ chọn giờ là **`2` : `15`**.
  * Cách 2: Tích chọn **`Custom`** $\rightarrow$ điền Crontab expression: `15 2 * * *`.
* **Timezone:** Chọn `Asia/Ho_Chi_Minh` (GMT+7).
* **Request Method:** Chọn **`POST`**.
* **Headers (thêm 3 dòng tương tự Cronjob 1 trong tab ADVANCED):**
  * `Accept`: `application/vnd.github.v3+json`
  * `Authorization`: `Bearer MÃ_TOKEN_CỦA_BẠN`
  * `User-Agent`: `Durian-Tracker`
* **Request Body:**
  ```json
  {"ref": "main", "inputs": {"limit_per_channel": "6"}}
  ```
* Bấm nút màu cam **CREATE** để lưu.

---

### Bước 3: Kiểm Tra Thử Nghiệm Ngay Lập Tức

1. Trong danh sách Cronjob trên `cron-job.org`, bạn tìm từng cronjob vừa tạo và nhấn vào biểu tượng **Chạy thử (Run now / biểu tượng Play $\blacktriangleright$)**.
2. Kiểm tra cột kết quả thực thi:
   * Nếu hiện **Status: 204 No Content** (hoặc `204 OK`) màu xanh lá $\rightarrow$ **Cấu hình chuẩn xác 100%!**
3. Mở tab **Actions** trên GitHub: Bạn sẽ thấy ngay lập tức tiến trình tương ứng đang quay vòng vàng chạy tức thì mà không hề bị delay dù chỉ 1 giây!


