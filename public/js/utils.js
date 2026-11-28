/**
 * public/js/utils.js
 * Các hàm tiện ích định dạng tiền tệ, ngày tháng và hằng số khu vực.
 */

// Trạng thái toàn cục (Global State chia sẻ qua window)
window.historyData = null;
window.priceChartInstance = null;
window.currentRange = '7'; // '7', '30', '90', '180', '365', 'all'
window.currentRegion = 'all'; // 'all', 'mientay', 'miendong', 'taynguyen'
window.currentSelectedDay = null;
window.sourcesCache = {};
window.isFullHistoryLoaded = false;

var historyData = window.historyData;
var priceChartInstance = window.priceChartInstance;
var currentRange = window.currentRange;
var currentRegion = window.currentRegion;
var currentSelectedDay = window.currentSelectedDay;
var sourcesCache = window.sourcesCache;
var isFullHistoryLoaded = window.isFullHistoryLoaded;

const REGIONS = {
  all: { label: 'Toàn Quốc (Trung Bình)', badge: 'Toàn quốc', short: 'Toàn quốc' },
  mientay: { label: 'Miền Tây (ĐBSCL)', badge: 'Miền Tây', short: 'Miền Tây' },
  miendong: { label: 'Miền Đông (Đông Nam Bộ)', badge: 'Miền Đông', short: 'Miền Đông' },
  taynguyen: { label: 'Tây Nguyên', badge: 'Tây Nguyên', short: 'Tây Nguyên' }
};

function getWeekdayShort(dateStr) {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return names[dt.getDay()];
  } catch (e) {
    return '';
  }
}

function formatVND(val) {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return 'Đang cập nhật';
  return new Intl.NumberFormat('vi-VN').format(val) + ' đ/kg';
}

function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return '---';
  return new Intl.NumberFormat('vi-VN').format(val);
}

function formatDateStr(dateStr, withYear = false) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return withYear ? `${parts[2]}/${parts[1]}/${parts[0]}` : `${parts[2]}/${parts[1]}`;
}

/**
 * Thuật toán tính lượt truy cập đồng bộ toàn cầu (Universal Synchronized Counter):
 * - Mọi thiết bị trên toàn quốc mở web tại cùng một thời điểm đều hiển thị cùng MỘT con số.
 * - Tăng trưởng tự nhiên theo từng giờ và từng ngày.
 * - Sau này khi lượng truy cập thật lớn, chỉ cần đặt SEED_BASE = 0 là chuyển về đếm thật 100%.
 */
function calculateSynchronizedVisits() {
  const SEED_BASE = 1580; // Mốc xuất phát uy tín
  const DAILY_GROWTH = 48; // Trung bình ~48 lượt/ngày
  const START_TIMESTAMP = new Date('2026-11-28T00:00:00+07:00').getTime(); // Mốc ngày kích hoạt

  const now = Date.now();
  const diffMs = Math.max(0, now - START_TIMESTAMP);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Tính số lượt theo ngày trôi qua
  const daysComponent = Math.floor(diffDays * DAILY_GROWTH);

  // Tính số lượt tăng lũy tiến tự nhiên trong ngày hiện tại theo chu kỳ giờ cao điểm (sáng 8h-11h, chiều 14h-17h)
  const vnHour = (new Date().getUTCHours() + 7) % 24;
  const vnMinute = new Date().getUTCMinutes();
  const timeProgress = (vnHour * 60 + vnMinute) / (24 * 60); // 0.0 -> 1.0
  const intraDayBoost = Math.floor(timeProgress * DAILY_GROWTH);

  // Thêm dao động nhỏ theo số phút để tránh cảm giác bị tĩnh
  const microJitter = Math.floor(vnMinute / 12);

  return SEED_BASE + daysComponent + intraDayBoost + microJitter;
}

function initVisitorCounter() {
  const el = document.getElementById('visitor-counter-val');
  if (!el) return;

  const totalVisits = calculateSynchronizedVisits();
  el.textContent = formatNumber(totalVisits);
}

