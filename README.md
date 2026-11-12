ba

# 🍈 Gia Sau Rieng Tracker (`gia-sau-rieng-tracker`)

> Hệ thống tự động thu thập, phân tích và theo dõi biến động giá sầu riêng (Ri6, Monthong Thái, Musang King) hàng ngày từ các kênh YouTube uy tín tại Miền Tây & Tây Nguyên.
> **100% Tự động & Hoàn toàn miễn phí** thông qua **GitHub Actions**, **Google Gemini AI**, và **Cloudflare Pages**.

---

## 🌟 Tính Năng Nổi Bật

- ⏱ **Cập nhật tự động định kỳ:** GitHub Actions tự động kích hoạt mỗi 3 tiếng (`0 */3 * * *`), không tốn server riêng.
- ⚡ **Thu thập thông minh không tốn quota:** Lấy video mới nhất qua YouTube RSS Feeds mà không bị giới hạn quota của YouTube Data API v3.
- 🧠 **Trích xuất bằng Google Gemini AI:**
  - Lấy phụ đề tiếng Việt tự động bằng `youtube-transcript-api`.
  - Gemini Flash tự động hiểu ngữ điệu và phát âm địa phương ("di sáu" → Ri6, "mỏn thon/thái" → Monthong, "mút sang kinh" → Musang King).
  - Trả về JSON chuẩn (Structured Outputs) với các loại giá: Ri6 A/B, Monthong A/B, Musang King.
- 📊 **Giao diện hiện đại & mượt mà:**
  - Viết bằng HTML5 thuần, **Tailwind CSS** (CDN) và **Chart.js** (CDN).
  - Không cần bước build Node.js phức tạp, deploy tức thì lên **Cloudflare Pages** (chỉ định thư mục `public`).
  - Biểu đồ biến động giá tương tác (lọc 7 ngày, 30 ngày, tất cả).
  - Thẻ tóm tắt biến động giá trung bình kèm so sánh tăng/giảm với ngày hôm trước.
  - Chi tiết nguồn tin từng video kèm tóm tắt thị trường bằng AI và link video gốc.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
gia-sau-rieng-tracker/
├── .github/
│   └── workflows/
│       └── update_prices.yml      # Tự động hóa chạy mỗi 3 tiếng & commit kết quả
├── scripts/
│   ├── fetch_prices.py            # Logic chính: RSS -> Transcript -> Gemini -> history.json
│   └── requirements.txt           # Thư viện Python (feedparser, requests, youtube-transcript-api, google-genai)
├── public/                        # Thư mục Web Tĩnh Deploy lên Cloudflare Pages
│   ├── index.html                 # Giao diện responsive với Tailwind CSS
│   ├── app.js                     # Xử lý render UI, biểu đồ Chart.js & bộ lọc
│   └── data/
│       ├── channels.json          # Danh sách kênh YouTube cần theo dõi
│       ├── processed_videos.json  # Bộ nhớ đệm danh sách video đã quét
│       └── history.json           # Cơ sở dữ liệu JSON theo ngày (giá trung bình + sources)
└── README.md                      # Hướng dẫn chi tiết
```

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai Chi Tiết

### Bước 1: Cách Lấy Channel ID YouTube Và Cấu Hình `channels.json`

File `public/data/channels.json` lưu danh sách các kênh YouTube bạn muốn AI quét phụ đề và lấy giá.

#### Cách lấy Channel ID YouTube (`UC...`):

1. Mở kênh YouTube muốn theo dõi trên trình duyệt (ví dụ: kênh của vựa thu mua hoặc nhà vườn).
2. Nhấn chuột phải vào khoảng trống trên trang kênh $\rightarrow$ Chọn **"Xem nguồn trang"** (View Page Source).
3. Nhấn `Ctrl + F` (hoặc `Cmd + F` trên Mac) và tìm kiếm chuỗi: `itemprop="channelId"` hoặc `externalId`.
4. Bạn sẽ thấy một mã bắt đầu bằng `UC`, ví dụ: `UC_x5XG1OV2P6uZZ5FSM9Ttw` (độ dài 24 ký tự).
5. Mở file `public/data/channels.json` và thêm vào danh sách theo mẫu:

```json
[
  {
    "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "name": "Sầu Riêng Tây Nguyên 24h",
    "region": "Tây Nguyên",
    "enabled": true
  },
  {
    "channel_id": "UCfEtwgGq1e3Lq7Y2aC5N_tg",
    "name": "Nhà Vườn Miền Tây - Cập Nhật Giá",
    "region": "Miền Tây",
    "enabled": true
  }
]
```

---

### Bước 2: Tạo `GEMINI_API_KEY` Miễn Phí & Thêm Vào GitHub Secrets

Google cung cấp miễn phí quota cho Gemini Flash trên Google AI Studio.

1. **Lấy API Key:**

   - Truy cập **[Google AI Studio](https://aistudio.google.com/)**.
   - Đăng nhập bằng tài khoản Google.
   - Nhấn **"Get API key"** $\rightarrow$ **"Create API key"**.
   - Sao chép khóa bí mật vừa tạo.
2. **Thêm vào GitHub Repository Secrets:**

   - Đẩy (push) mã nguồn dự án lên repository của bạn trên GitHub.
   - Truy cập repository trên GitHub: **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
   - Nhấn **New repository secret**.
   - **Name:** Điền chính xác `GEMINI_API_KEY`.
   - **Secret:** Dán mã API Key bạn vừa sao chép ở trên.
   - Nhấn **Add secret**.
3. **Cấp quyền ghi cho GitHub Actions Bot:**

   - Tại trang repo: Vào **Settings** $\rightarrow$ **Actions** $\rightarrow$ **General**.
   - Cuộn xuống phần **Workflow permissions**.
   - Chọn **Read and write permissions**.
   - Tích chọn **Allow GitHub Actions to create and approve pull requests**.
   - Nhấn **Save**.

---

### Bước 3: Triển Khai Miễn Phí Lên Cloudflare Pages

Cloudflare Pages hỗ trợ hosting các trang web tĩnh toàn cầu với tốc độ cực nhanh, băng thông không giới hạn và hoàn toàn miễn phí.

1. Đăng nhập vào trang quản trị **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Chọn menu bên trái: **Compute (Workers & Pages)** $\rightarrow$ **Pages** $\rightarrow$ Nhấn **Connect to Git** (Kết nối với Git).
3. Chọn tài khoản GitHub của bạn và chọn repository `gia-sau-rieng-tracker`.
4. Trong màn hình **Set up builds and deployments**:
   - **Project name:** `gia-sau-rieng-tracker` (hoặc tên tùy bạn chọn).
   - **Production branch:** `main` (hoặc `master`).
   - **Framework preset:** Chọn **None**.
   - **Build command:** Để trống (vì web tĩnh thuần HTML/JS, không cần bước build).
   - **Build output directory:** Điền chính xác `public`.
5. Nhấn **Save and Deploy**.
6. Chỉ sau khoảng 15-30 giây, website của bạn sẽ hoạt động với tên miền miễn phí dạng:
   `https://gia-sau-rieng-tracker.pages.dev`

> **Lưu ý:** Khi GitHub Actions tự động commit dữ liệu mới vào `public/data/`, Cloudflare Pages sẽ tự động kích hoạt triển khai lại phiên bản mới nhất ngay lập tức!

---

### Bước 4: Chạy Thử Nghiệm Tại Máy Cục Bộ (Local)

Nếu bạn muốn chạy thử nghiệm pipeline trên máy tính của mình:

```bash
# 1. Di chuyển vào thư mục dự án
cd gia-sr

# 2. Cài đặt các thư viện cần thiết
pip install -r scripts/requirements.txt

# 3. Thiết lập biến môi trường API Key
export GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"

# 4. Chạy script thu thập dữ liệu
python scripts/fetch_prices.py

# 5. Mở giao diện web thử nghiệm
cd public
python3 -m http.server 8080
# Mở trình duyệt tại http://localhost:8080
```

---

## ⚙️ Cơ Chế Tính Giá & Xử Lý Dữ Liệu

1. **Khử trùng lặp:** Video đã quét sẽ được lưu ID vào `processed_videos.json`. Mỗi video chỉ phân tích 1 lần duy nhất.
2. **Khắc phục lỗi nhận diện giọng nói:** Prompt của Gemini được huấn luyện đặc thù cho phương ngữ Nam Bộ và Tây Nguyên ("di sáu", "mỏn thon", "mút sang kinh").
3. **Tính giá trung bình chuẩn xác:**
   $$
   \text{Giá TB ngày} = \frac{\sum \text{Giá các nguồn hợp lệ}}{\text{Số nguồn nhắc đến giống đó}}
   $$

   Các trường hợp `null` được loại bỏ hoàn toàn khỏi mẫu số, không bị tính nhầm thành giá 0.
4. **Giữ liền mạch biểu đồ:** Cấu hình `spanGaps: true` trong Chart.js giúp đường đồ thị không bị gián đoạn ngay cả khi có ngày không phát sinh giao dịch của một giống sầu riêng hiếm.

---

## 📄 Bản Quyền & Giấy Phép

Dự án được phát hành theo giấy phép mã nguồn mở MIT. Bạn được toàn quyền tùy biến, chia sẻ và phát triển cho các loại nông sản khác (cà phê, tiêu, lúa gạo,...).
