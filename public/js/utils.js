/**
 * public/js/utils.js
 * Các hàm tiện ích định dạng tiền tệ, ngày tháng và hằng số khu vực.
 */

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
