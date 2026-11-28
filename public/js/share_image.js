/**
 * public/js/share_image.js
 * Tạo ảnh infographic bảng giá sầu riêng bằng HTML5 Canvas trực tiếp trên trình duyệt (0đ, 0 server).
 * Hỗ trợ Web Share API (chia sẻ 1 chạm thẳng sang Zalo/Facebook) và tải file PNG chất lượng cao.
 */

// Hàm tạo và hiển thị ảnh bảng giá
async function generatePriceInfographic() {
  if (!historyData || !historyData.days) {
    alert('Dữ liệu giá chưa sẵn sàng. Vui lòng thử lại sau giây lát!');
    return;
  }

  const daysKeys = historyData.available_days || Object.keys(historyData.days).sort().reverse();
  const activeDay = currentSelectedDay || daysKeys[0];
  const dayData = historyData.days[activeDay];
  if (!dayData) return;

  // Lấy giá theo khu vực hiện tại
  let prices = dayData.daily_average || {};
  let regionName = 'Toàn Quốc (Trung Bình)';
  if (currentRegion !== 'all' && dayData.by_region && dayData.by_region[currentRegion]) {
    prices = dayData.by_region[currentRegion];
    const regionNames = {
      mientay: 'Miền Tây (ĐBSCL)',
      miendong: 'Miền Đông Nam Bộ',
      taynguyen: 'Tây Nguyên'
    };
    regionName = regionNames[currentRegion] || currentRegion;
  }

  // Khởi tạo Canvas chuẩn vuông 1080 x 1080 px (chuẩn ảnh Zalo/FB sắc nét)
  const canvas = document.createElement('canvas');
  const w = 1080;
  const h = 1080;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1. Nền Gradient Emerald sang trọng
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#064e3b');   // Emerald 900
  grad.addColorStop(0.5, '#065f46'); // Emerald 800
  grad.addColorStop(1, '#022c22');   // Emerald 950
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Hiệu ứng ánh sáng mờ trang trí
  const glow = ctx.createRadialGradient(w / 2, 200, 50, w / 2, 200, 500);
  glow.addColorStop(0, 'rgba(251, 191, 36, 0.15)'); // Amber gold
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Viền trang trí ngoài (Border)
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  // 2. Header
  // Logo & Tiêu đề
  ctx.textAlign = 'center';

  // Badge Khu vực
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px "Be Vietnam Pro", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText(`KHU VỰC: ${regionName.toUpperCase()}`, w / 2, 85);

  // Tiêu đề chính
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px "Be Vietnam Pro", sans-serif';
  ctx.fillText('BẢNG GIÁ SẦU RIÊNG CẮT XÔ TẠI VƯỜN', w / 2, 145);

  // Ngày áp dụng
  const weekday = getWeekdayShort(activeDay);
  const dateFormatted = formatDateStr(activeDay, true);
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '600 24px "Be Vietnam Pro", sans-serif';
  ctx.fillText(`Áp dụng ngày: ${weekday}, ${dateFormatted}`, w / 2, 190);

  // Đường kẻ phân cách
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 220);
  ctx.lineTo(w - 80, 220);
  ctx.stroke();

  // 3. Danh sách các giống sầu riêng (Bảng giá 2 cột hoặc lưới)
  const items = [
    { name: 'Sầu Riêng Ri6 (Xô 8:2)', price: prices.ri6_a, note: 'Vườn đẹp' },
    { name: 'Sầu Riêng Ri6 (Xô 7:3)', price: prices.ri6_b, note: 'Vườn trung bình' },
    { name: 'Thái Monthong (Xô 8:2)', price: prices.monthong_a, note: 'Dona / Thái đẹp' },
    { name: 'Thái Monthong (Xô 7:3)', price: prices.monthong_b, note: 'Dona trung bình' },
    { name: 'Musang King', price: prices.musang_king, note: 'Cắt xô tại vườn' },
    { name: 'Black Thorn (Gai Đen)', price: prices.black_thorn, note: 'Cắt xô tại vườn' },
    { name: 'Chuồng Bò', price: prices.chuong_bo, note: 'Cắt xô tại vườn' },
    { name: 'Sáu Hữu', price: prices.sau_huu, note: 'Cắt xô tại vườn' }
  ];

  // Lọc chỉ các giống có dữ liệu (hoặc tối thiểu 6 giống)
  const validItems = items.filter(it => it.price && it.price > 0);
  const displayItems = validItems.length >= 4 ? validItems : items.slice(0, 6);

  const startY = 255;
  const rowH = 75;

  displayItems.forEach((item, i) => {
    const y = startY + (i * rowH);

    // Nền card từng dòng (hàng chẵn lẻ để dễ nhìn)
    ctx.fillStyle = (i % 2 === 0) ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(80, y, w - 160, rowH - 12, 14);
    ctx.fill();

    // Dấu chấm tròn màu vàng
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(115, y + (rowH - 12) / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Tên giống
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Be Vietnam Pro", sans-serif';
    ctx.fillText(item.name, 140, y + 36);

    // Ghi chú nhỏ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '500 18px "Be Vietnam Pro", sans-serif';
    ctx.fillText(item.note, 140, y + 58);

    // Mức giá (Nổi bật bên phải)
    ctx.textAlign = 'right';
    if (item.price && item.price > 0) {
      ctx.fillStyle = '#fde047'; // Vàng sáng
      ctx.font = '800 32px "Be Vietnam Pro", sans-serif';
      ctx.fillText(`${formatNumber(item.price)} đ/kg`, w - 110, y + 42);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '600 24px "Be Vietnam Pro", sans-serif';
      ctx.fillText('Đang cập nhật', w - 110, y + 42);
    }
  });

  // 4. Footer
  const footerY = 905;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.moveTo(80, footerY);
  ctx.lineTo(w - 80, footerY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde68a'; // Vàng nhạt cảnh báo
  ctx.font = '500 17px "Be Vietnam Pro", sans-serif';
  ctx.fillText('* Giá mang tính tham khảo xu hướng chung, giá thực tế phụ thuộc tỷ lệ thỏa thuận tại vườn', w / 2, footerY + 30);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '400 16px "Be Vietnam Pro", sans-serif';
  ctx.fillText('Tổng hợp tự động bằng AI từ các nhà vườn và vựa thu mua uy tín', w / 2, footerY + 58);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 22px "Be Vietnam Pro", sans-serif';
  ctx.fillText('🌱 Giá Sầu Riêng Xô Tại Vườn', w / 2, footerY + 95);

  // Hiển thị Modal xem trước ảnh
  showImagePreviewModal(canvas, activeDay);
}

// Modal xem trước và các nút tương tác (Download / Share)
function showImagePreviewModal(canvas, dayStr) {
  let modal = document.getElementById('share-image-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'share-image-modal';
    modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4';
    document.body.appendChild(modal);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const fileName = `bang-gia-sau-rieng-${dayStr}.png`;

  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
      <!-- Header Modal -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div class="flex items-center gap-2">
          <i class="fa-regular fa-image text-emerald-700 text-base"></i>
          <h3 class="font-bold text-slate-800 text-sm sm:text-base">Ảnh Bảng Giá Chia Sẻ</h3>
        </div>
        <button id="btn-close-share-modal" class="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
          ✕
        </button>
      </div>

      <!-- Khung hiển thị ảnh xem trước -->
      <div class="overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200 shadow-inner bg-slate-900 flex items-center justify-center p-2 mb-4">
        <img src="${dataUrl}" alt="Bảng giá sầu riêng" class="w-full h-auto rounded-lg shadow-md object-contain">
      </div>

      <!-- Các nút thao tác -->
      <div class="grid grid-cols-2 gap-2.5">
        <button id="btn-do-share-zalo" class="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer">
          <i class="fa-solid fa-share-nodes"></i>
          <span>Chia sẻ Zalo/FB</span>
        </button>
        <a id="btn-download-image" href="${dataUrl}" download="${fileName}" class="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-emerald-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer text-center">
          <i class="fa-solid fa-download"></i>
          <span>Tải Ảnh Về</span>
        </a>
      </div>

      <p id="share-copy-status" class="text-[11px] text-emerald-700 text-center font-medium mt-2 hidden">
        ✓ Đã sao chép ảnh vào bộ nhớ tạm! Bạn có thể dán (Paste) ngay vào Zalo/Facebook.
      </p>
    </div>
  `;

  modal.classList.remove('hidden');

  // Sự kiện đóng modal
  const closeModal = () => modal.classList.add('hidden');
  document.getElementById('btn-close-share-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Sự kiện Chia Sẻ (Web Share API hoặc Copy Clipboard)
  document.getElementById('btn-do-share-zalo').addEventListener('click', async () => {
    canvas.toBlob(async (blob) => {
      const statusText = document.getElementById('share-copy-status');
      const file = new File([blob], fileName, { type: 'image/png' });

      // Ưu tiên Web Share API trên điện thoại (mở thẳng Zalo/Messenger/FB)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Bảng giá sầu riêng ngày ${dayStr}`,
            text: `Bảng giá sầu riêng xô tại vườn ngày ${dayStr}. Xem chi tiết tại: https://vonguyendang.github.io/gia-sau-rieng/`
          });
          return;
        } catch (err) {
          if (err.name !== 'AbortError') console.warn('Lỗi chia sẻ:', err);
        }
      }

      // Fallback: Copy ảnh vào Clipboard
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          if (statusText) {
            statusText.classList.remove('hidden');
            setTimeout(() => statusText.classList.add('hidden'), 3500);
          }
        } else {
          // Fallback tải file nếu trình duyệt không hỗ trợ ClipboardItem
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = fileName;
          a.click();
        }
      } catch (err) {
        console.warn('Không thể sao chép ảnh:', err);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        a.click();
      }
    }, 'image/png');
  });
}
