/**
 * public/app.js
 * Điều phối chính (Main Orchestrator) của ứng dụng web Giá Sầu Riêng.
 * Quản lý trạng thái ứng dụng, nạp dữ liệu và gắn các sự kiện người dùng.
 * 
 * Các chức năng chi tiết được chia nhỏ trong thư mục public/js/:
 * - js/utils.js: Tiện ích định dạng tiền tệ, ngày tháng & hằng số khu vực
 * - js/cards.js: Header & 6 thẻ giá sầu riêng cắt xô tại vườn
 * - js/comparison.js: Bảng so sánh biến động giá (T-1, T-7, T-30, YoY)
 * - js/chart.js: Vẽ biểu đồ xu hướng giá (Chart.js) & bộ lọc thời gian
 * - js/sources.js: Bộ điều hướng ngày dạng lưới & danh sách bản tin YouTube
 */

// Trạng thái toàn cục (Global State)
let historyData = null;
let priceChartInstance = null;
let currentRange = '7'; // '7', '30', '90', '180', '365', 'all'
let currentRegion = 'all'; // 'all', 'mientay', 'miendong', 'taynguyen'
let currentSelectedDay = null;
const sourcesCache = {};
let isFullHistoryLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

function setupEventListeners() {
  // Nút làm mới dữ liệu
  const refreshBtn = document.getElementById('btn-refresh');
  const refreshIcon = document.getElementById('refresh-icon');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshIcon.classList.add('fa-spin');
      loadData().finally(() => {
        setTimeout(() => refreshIcon.classList.remove('fa-spin'), 600);
      });
    });
  }

  // Bộ chọn khu vực dạng dropdown list (select)
  const regionSelect = document.getElementById('region-select');
  if (regionSelect) {
    regionSelect.value = currentRegion;
    regionSelect.addEventListener('change', (e) => {
      currentRegion = e.target.value || 'all';
      renderPriceCards();
      renderComparisonTable();
      initOrUpdateChart();
    });
  }

  // Dự phòng nếu có nút bấm chọn khu vực
  const regionBtns = document.querySelectorAll('.region-filter-btn');
  regionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      regionBtns.forEach(b => {
        b.classList.remove('bg-emerald-800', 'text-white', 'font-bold');
        b.classList.add('bg-white', 'text-slate-700', 'font-semibold', 'border', 'border-slate-200');
      });
      btn.classList.add('bg-emerald-800', 'text-white', 'font-bold');
      btn.classList.remove('bg-white', 'text-slate-700', 'font-semibold', 'border', 'border-slate-200');

      currentRegion = btn.getAttribute('data-region') || 'all';
      if (regionSelect) regionSelect.value = currentRegion;
      renderPriceCards();
      renderComparisonTable();
      initOrUpdateChart();
    });
  });

  // Bộ lọc thời gian biểu đồ (1 tuần, 1 tháng, 3 tháng, 6 tháng, 1 năm, Tất cả)
  const filterBtns = document.querySelectorAll('.chart-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('bg-white', 'text-emerald-800', 'shadow-sm');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('bg-white', 'text-emerald-800', 'shadow-sm');
      btn.classList.remove('text-slate-600');

      currentRange = btn.getAttribute('data-range');
      updateChart();
    });
  });

  // Bộ chọn & điều hướng ngày dạng lưới (Grid Date Picker)
  const toggleBtn = document.getElementById('btn-date-picker-toggle');
  const popover = document.getElementById('date-picker-popover');
  const arrow = document.getElementById('date-picker-arrow');
  const prevBtn = document.getElementById('btn-prev-day');
  const nextBtn = document.getElementById('btn-next-day');
  const quickLatestBtn = document.getElementById('btn-quick-latest-day');

  if (toggleBtn && popover) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popover.classList.contains('hidden');
      if (isHidden) {
        popover.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
      } else {
        popover.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotate-180');
      }
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !toggleBtn.contains(e.target)) {
        popover.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotate-180');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
        popover.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotate-180');
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (!historyData) return;
      const daysKeys = historyData.available_days || (historyData.days ? Object.keys(historyData.days).sort().reverse() : []);
      const idx = daysKeys.indexOf(currentSelectedDay);
      if (idx !== -1 && idx < daysKeys.length - 1) {
        selectDay(daysKeys[idx + 1]);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!historyData) return;
      const daysKeys = historyData.available_days || (historyData.days ? Object.keys(historyData.days).sort().reverse() : []);
      const idx = daysKeys.indexOf(currentSelectedDay);
      if (idx > 0) {
        selectDay(daysKeys[idx - 1]);
      }
    });
  }

  if (quickLatestBtn) {
    quickLatestBtn.addEventListener('click', () => {
      if (!historyData) return;
      const daysKeys = historyData.available_days || (historyData.days ? Object.keys(historyData.days).sort().reverse() : []);
      if (daysKeys.length > 0) {
        selectDay(daysKeys[0], true);
      }
    });
  }

  // Tương thích ngược nếu còn select cũ
  const dateSelect = document.getElementById('date-select');
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      selectDay(e.target.value);
    });
  }
}

async function loadData() {
  try {
    // Kiến trúc 2 tầng: Ưu tiên tải latest.json (siêu nhẹ ~12KB) để mở web tức thì
    let res;
    try {
      res = await fetch(`data/latest.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('latest.json không khả dụng');
    } catch (e) {
      // Fallback tự động sang history.json nếu latest.json chưa có
      res = await fetch(`data/history.json?t=${Date.now()}`);
    }
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    historyData = await res.json();

    // Cache nguồn tin của ngày mới nhất nếu đã có trong latest.json
    if (historyData.latest_day && historyData.latest_sources) {
      sourcesCache[historyData.latest_day] = historyData.latest_sources;
    }

    renderHeader();
    renderPriceCards();
    renderComparisonTable();
    initOrUpdateChart();
    populateDateSelect();
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu giá:', error);
    const container = document.getElementById('price-cards-container');
    if (container) {
      container.innerHTML = `
        <div class="col-span-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          <i class="fa-solid fa-circle-exclamation mr-1"></i>
          Không thể tải dữ liệu giá mới nhất. Vui lòng thử lại sau giây lát.
        </div>
      `;
    }
  }
}
