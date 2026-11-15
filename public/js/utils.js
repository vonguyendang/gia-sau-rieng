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
