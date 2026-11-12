/**
 * public/app.js
 * Quản lý logic hiển thị dữ liệu giá sầu riêng, vẽ biểu đồ Chart.js và danh sách nguồn tin.
 * Chuẩn hóa 6 giống sầu riêng theo thứ tự phân cấp giá từ cao đến thấp:
 * 1. Black Thorn (Gai Đen)
 * 2. Musang King
 * 3. Sầu riêng Sáu Hữu
 * 4. Sầu riêng Thái (Monthong / Dona) (Xô 8:2 & 7:3)
 * 5. Sầu riêng Chuồng Bò
 * 6. Sầu riêng Ri6 (Xô 8:2 & 7:3)
 */

let historyData = null;
let priceChartInstance = null;
let currentRange = '7'; // '7', '30', 'all'

// Định dạng số thành tiền tệ VNĐ
function formatVND(val) {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return 'Đang cập nhật';
  return new Intl.NumberFormat('vi-VN').format(val) + ' đ/kg';
}

function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return '---';
  return new Intl.NumberFormat('vi-VN').format(val);
}

// Định dạng ngày ngắn gọn (DD/MM) hoặc (DD/MM/YYYY)
function formatDateStr(dateStr, withYear = false) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return withYear ? `${parts[2]}/${parts[1]}/${parts[0]}` : `${parts[2]}/${parts[1]}`;
}

// Khởi tạo khi trang tải xong
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

function setupEventListeners() {
  // Nút refresh
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

  // Bộ lọc thời gian biểu đồ
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

  // Bộ chọn ngày cho danh sách nguồn tin
  const dateSelect = document.getElementById('date-select');
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      renderSources(e.target.value);
    });
  }
}

async function loadData() {
  try {
    const res = await fetch(`data/history.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    historyData = await res.json();

    renderHeader();
    renderPriceCards();
    initOrUpdateChart();
    populateDateSelect();
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu history.json:', error);
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

function renderHeader() {
  if (!historyData) return;

  const lastUpdatedEl = document.getElementById('last-updated-text');
  if (lastUpdatedEl && historyData.last_updated) {
    const dt = new Date(historyData.last_updated);
    if (!isNaN(dt.getTime())) {
      lastUpdatedEl.textContent = dt.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } else {
      lastUpdatedEl.textContent = historyData.last_updated;
    }
  }

  // Lấy ngày mới nhất có trong days
  const daysKeys = Object.keys(historyData.days || {}).sort();
  const latestDay = daysKeys[daysKeys.length - 1] || '';
  const currentDayLabel = document.getElementById('current-day-label');
  if (currentDayLabel && latestDay) {
    currentDayLabel.textContent = formatDateStr(latestDay, true);
  }
}

function renderPriceCards() {
  if (!historyData || !historyData.days) return;

  const daysKeys = Object.keys(historyData.days).sort();
  if (daysKeys.length === 0) return;

  const latestDay = daysKeys[daysKeys.length - 1];
  const prevDay = daysKeys.length > 1 ? daysKeys[daysKeys.length - 2] : null;

  const todayAvg = historyData.days[latestDay]?.daily_average || {};
  const prevAvg = prevDay ? (historyData.days[prevDay]?.daily_average || {}) : {};

  // Hàm tính chênh lệch giá so với ngày trước
  function getDiff(todayVal, prevVal) {
    if (!todayVal || !prevVal) return { text: 'Chưa có so sánh', class: 'text-slate-400', icon: 'fa-minus' };
    const diff = todayVal - prevVal;
    const pct = ((diff / prevVal) * 100).toFixed(1);
    if (diff > 0) {
      return {
        text: `+${new Intl.NumberFormat('vi-VN').format(diff)} đ (+${pct}%)`,
        class: 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold',
        icon: 'fa-arrow-trend-up'
      };
    } else if (diff < 0) {
      return {
        text: `${new Intl.NumberFormat('vi-VN').format(diff)} đ (${pct}%)`,
        class: 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-semibold',
        icon: 'fa-arrow-trend-down'
      };
    }
    return {
      text: 'Đứng giá (0%)',
      class: 'text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full',
      icon: 'fa-equals'
    };
  }

  // 6 Giống sầu riêng chuẩn theo thứ tự phân cấp giá từ cao đến thấp
  const cardsConfig = [
    {
      title: '1. Black Thorn (Gai Đen)',
      tag: 'Đỉnh Giá Xô Vườn',
      key: 'black_thorn',
      isRange: false,
      accentColor: 'border-l-4 border-rose-500',
      badgeColor: 'bg-rose-100 text-rose-900',
      icon: 'fa-solid fa-fire',
      subText: 'Đỉnh cao thị trường, dòng sầu riêng đắt nhất'
    },
    {
      title: '2. Musang King',
      tag: 'Vua Sầu Riêng',
      key: 'musang_king',
      isRange: false,
      accentColor: 'border-l-4 border-purple-500',
      badgeColor: 'bg-purple-100 text-purple-900',
      icon: 'fa-solid fa-gem',
      subText: 'Thơm béo nồng nàn, cơm vàng mịn đặc sắc'
    },
    {
      title: '3. Sầu riêng Sáu Hữu',
      tag: 'Đặc Sản Hạt Lép',
      key: 'sau_huu',
      isRange: false,
      accentColor: 'border-l-4 border-orange-500',
      badgeColor: 'bg-orange-100 text-orange-900',
      icon: 'fa-solid fa-star',
      subText: 'Cơm vàng óng, dẻo ngọt đặc sản nổi tiếng'
    },
    {
      title: '4. Thái (Monthong / Dona)',
      tag: 'Giá Cắt Xô Vườn',
      keyHigh: 'monthong_a', // Tỉ lệ 8:2
      keyLow: 'monthong_b',  // Tỉ lệ 7:3
      isRange: true,
      accentColor: 'border-l-4 border-amber-500',
      badgeColor: 'bg-amber-100 text-amber-900',
      icon: 'fa-solid fa-crown',
      subText: 'Giá xô cả vườn theo tỉ lệ phân loại trái'
    },
    {
      title: '5. Sầu riêng Chuồng Bò',
      tag: 'Giống Truyền Thống',
      key: 'chuong_bo',
      isRange: false,
      accentColor: 'border-l-4 border-cyan-600',
      badgeColor: 'bg-cyan-100 text-cyan-900',
      icon: 'fa-solid fa-leaf',
      subText: 'Đặc sản truyền thống vị béo ngậy ngọt thanh'
    },
    {
      title: '6. Sầu riêng Ri6',
      tag: 'Giá Cắt Xô Vườn',
      keyHigh: 'ri6_a', // Tỉ lệ 8:2
      keyLow: 'ri6_b',  // Tỉ lệ 7:3
      isRange: true,
      accentColor: 'border-l-4 border-emerald-600',
      badgeColor: 'bg-emerald-100 text-emerald-900',
      icon: 'fa-solid fa-award',
      subText: 'Giá xô cả vườn theo tỉ lệ phân loại trái'
    }
  ];

  const mainContainer = document.getElementById('price-cards-container');
  if (!mainContainer) return;

  mainContainer.innerHTML = cardsConfig.map(c => {
    if (c.isRange) {
      // Dành cho Thái Monthong và Ri6 (Hiển thị khoảng giá xô 7:3 - 8:2)
      const highVal = todayAvg[c.keyHigh];
      const lowVal = todayAvg[c.keyLow];
      const prevHigh = prevAvg[c.keyHigh];
      const diffInfo = getDiff(highVal, prevHigh);

      const priceDisplay = (lowVal && highVal)
        ? `${formatNumber(lowVal)} – ${formatNumber(highVal)}`
        : (highVal ? formatNumber(highVal) : 'Đang cập nhật');

      return `
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 ${c.accentColor} hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${c.badgeColor} truncate max-w-[210px] flex items-center gap-1.5">
                <i class="${c.icon}"></i> ${c.title}
              </span>
              <span class="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                Xô tại vườn
              </span>
            </div>

            <!-- Giá Xô Chính -->
            <div class="mt-3 flex items-baseline justify-between">
              <div>
                <span class="text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">Giá xô cả vườn:</span>
                <div class="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-none mt-1">
                  ${priceDisplay}
                </div>
              </div>
              <span class="text-xs font-bold text-slate-500">đ / kg</span>
            </div>

            <!-- Chi tiết phân loại theo tỉ lệ trái 8:2 và 7:3 -->
            <div class="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5">
              <div class="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <span class="text-slate-600 font-medium">Tỉ lệ 8:2 (Vườn đẹp):</span>
                <span class="font-bold text-slate-900">${formatVND(highVal)}</span>
              </div>
              <div class="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <span class="text-slate-600 font-medium">Tỉ lệ 7:3 (Vườn thường):</span>
                <span class="font-bold text-slate-900">${formatVND(lowVal)}</span>
              </div>
            </div>
          </div>

          <div>
            <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="text-slate-500 text-[11px]">So với hôm qua (Xô 8:2):</span>
              <span class="font-semibold text-[11px] flex items-center gap-1 ${diffInfo.class}">
                <i class="fa-solid ${diffInfo.icon} text-[9px]"></i>
                ${diffInfo.text}
              </span>
            </div>
            <div class="mt-1 text-[11px] text-slate-400">
              ${c.subText}
            </div>
          </div>
        </div>
      `;
    } else {
      // Dành cho Black Thorn, Musang King, Sáu Hữu, Chuồng Bò
      const val = todayAvg[c.key];
      const prevVal = prevAvg[c.key];
      const diffInfo = getDiff(val, prevVal);

      return `
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 ${c.accentColor} hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${c.badgeColor} truncate max-w-[210px] flex items-center gap-1.5">
                <i class="${c.icon}"></i> ${c.title}
              </span>
              <span class="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                ${c.tag}
              </span>
            </div>

            <div class="mt-3 flex items-baseline justify-between">
              <div>
                <span class="text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">Giá xô tại vườn:</span>
                <div class="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-none mt-1">
                  ${val ? formatNumber(val) : '<span class="text-slate-400 text-lg">Đang cập nhật</span>'}
                </div>
              </div>
              ${val ? '<span class="text-xs font-bold text-slate-500">đ / kg</span>' : ''}
            </div>

            <div class="mt-4 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 flex items-center gap-2">
              <i class="fa-solid fa-circle-info text-slate-400"></i>
              <span>${c.subText}</span>
            </div>
          </div>

          <div>
            <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="text-slate-500 text-[11px]">So với hôm qua:</span>
              <span class="font-semibold text-[11px] flex items-center gap-1 ${diffInfo.class}">
                <i class="fa-solid ${diffInfo.icon} text-[9px]"></i>
                ${diffInfo.text}
              </span>
            </div>
            <div class="mt-1 text-[11px] text-slate-400">
              Cập nhật trực tiếp từ thương lái mua tại vườn
            </div>
          </div>
        </div>
      `;
    }
  }).join('');
}

function initOrUpdateChart() {
  if (!historyData || !historyData.days) return;

  const daysKeys = Object.keys(historyData.days).sort();
  let selectedDays = daysKeys;

  if (currentRange === '7') {
    selectedDays = daysKeys.slice(-7);
  } else if (currentRange === '30') {
    selectedDays = daysKeys.slice(-30);
  } else {
    selectedDays = daysKeys;
  }

  const isDense = selectedDays.length > 60;
  const pRadius = isDense ? 0 : 4;
  const pHoverRadius = isDense ? 5 : 7;
  const bWidth = isDense ? 2 : 2.5;

  const labels = selectedDays.map(d => formatDateStr(d));
  const blackThornData = selectedDays.map(d => historyData.days[d]?.daily_average?.black_thorn ?? null);
  const musangData = selectedDays.map(d => historyData.days[d]?.daily_average?.musang_king ?? null);
  const sauHuuData = selectedDays.map(d => historyData.days[d]?.daily_average?.sau_huu ?? null);
  const monthongData = selectedDays.map(d => historyData.days[d]?.daily_average?.monthong_a ?? null);
  const chuongBoData = selectedDays.map(d => historyData.days[d]?.daily_average?.chuong_bo ?? null);
  const ri6Data = selectedDays.map(d => historyData.days[d]?.daily_average?.ri6_a ?? null);

  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: '1. Black Thorn (Gai Đen)',
        data: blackThornData,
        borderColor: '#e11d48',
        backgroundColor: 'rgba(225, 29, 72, 0.08)',
        borderWidth: bWidth,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#e11d48',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: '2. Musang King',
        data: musangData,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        borderWidth: bWidth,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#7c3aed',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: '3. Sầu riêng Sáu Hữu',
        data: sauHuuData,
        borderColor: '#ea580c',
        borderWidth: isDense ? 1.5 : 2,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#ea580c',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: '4. Thái Monthong (Xô 8:2)',
        data: monthongData,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.10)',
        borderWidth: bWidth,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#d97706',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: '5. Sầu riêng Chuồng Bò',
        data: chuongBoData,
        borderColor: '#0891b2',
        borderWidth: isDense ? 1.5 : 2,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#0891b2',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: '6. Sầu riêng Ri6 (Xô 8:2)',
        data: ri6Data,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.10)',
        borderWidth: bWidth,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#059669',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { family: '"Be Vietnam Pro"', size: 12, weight: '600' },
          usePointStyle: true,
          padding: 16,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleFont: { family: '"Be Vietnam Pro"', size: 13, weight: '700' },
        bodyFont: { family: '"Be Vietnam Pro"', size: 12 },
        padding: 12,
        cornerRadius: 8,
        itemSort: function(a, b) {
          const valA = a.parsed.y !== null ? a.parsed.y : -1;
          const valB = b.parsed.y !== null ? b.parsed.y : -1;
          return valB - valA;
        },
        callbacks: {
          label: function(context) {
            const dayKey = selectedDays[context.dataIndex];
            const avg = historyData.days[dayKey]?.daily_average || {};
            const lbl = context.dataset.label || '';

            if (lbl.includes('Ri6')) {
              const low = avg.ri6_b ? formatNumber(avg.ri6_b) : '48.000';
              const high = avg.ri6_a ? formatNumber(avg.ri6_a) : '53.000';
              return `6. Ri6 Xô Vườn: ${low} – ${high} đ/kg (8:2: ${high}k | 7:3: ${low}k)`;
            }

            if (lbl.includes('Thái')) {
              const low = avg.monthong_b ? formatNumber(avg.monthong_b) : '70.000';
              const high = avg.monthong_a ? formatNumber(avg.monthong_a) : '78.000';
              return `4. Thái Monthong Xô: ${low} – ${high} đ/kg (8:2: ${high}k | 7:3: ${low}k)`;
            }

            if (context.parsed.y !== null) {
              return `${lbl}: ${new Intl.NumberFormat('vi-VN').format(context.parsed.y)} đ/kg (xô vườn)`;
            }
            return `${lbl}: Đang cập nhật`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: '"Be Vietnam Pro"', size: 11 },
          color: '#64748b',
          maxTicksLimit: isDense ? 12 : 10,
          maxRotation: 0,
        }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { family: '"Be Vietnam Pro"', size: 11 },
          color: '#64748b',
          callback: function(value) {
            return (value / 1000) + 'k';
          }
        }
      }
    }
  };

  if (priceChartInstance) {
    priceChartInstance.data = chartData;
    priceChartInstance.options = chartOptions;
    priceChartInstance.update();
  } else {
    priceChartInstance = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });
  }
}

function updateChart() {
  initOrUpdateChart();
}

function populateDateSelect() {
  if (!historyData || !historyData.days) return;

  const dateSelect = document.getElementById('date-select');
  if (!dateSelect) return;

  const daysKeys = Object.keys(historyData.days).sort().reverse();
  if (daysKeys.length === 0) return;

  dateSelect.innerHTML = daysKeys.map(d => {
    return `<option value="${d}">${formatDateStr(d, true)}</option>`;
  }).join('');

  // Mặc định render ngày mới nhất
  renderSources(daysKeys[0]);
}

function renderSources(selectedDay) {
  if (!historyData || !historyData.days) return;

  const container = document.getElementById('sources-list-container');
  if (!container) return;

  const dayData = historyData.days[selectedDay];
  if (!dayData || !dayData.sources || dayData.sources.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white p-8 rounded-2xl text-center border border-slate-200">
        <i class="fa-solid fa-inbox text-4xl text-slate-300 mb-2"></i>
        <div class="text-sm font-semibold text-slate-600">Không có bản tin nguồn nào cho ngày này</div>
        <div class="text-xs text-slate-400 mt-1">Dữ liệu có thể chưa được tổng hợp hoặc kênh chưa ra video mới.</div>
      </div>
    `;
    return;
  }

  const regionColors = {
    'Miền Tây': 'bg-blue-50 text-blue-700 border-blue-200',
    'Tây Nguyên': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Đông Nam Bộ': 'bg-amber-50 text-amber-700 border-amber-200',
    'Chung': 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const PRIORITY_CHANNEL_ID = 'UCX11-9EVu6AzLYorQNoLzRA';

  // Sắp xếp nguồn ưu tiên lên vị trí đầu tiên
  const sortedSources = [...dayData.sources].sort((a, b) => {
    const aIsPri = a.channel_id === PRIORITY_CHANNEL_ID;
    const bIsPri = b.channel_id === PRIORITY_CHANNEL_ID;
    if (aIsPri && !bIsPri) return -1;
    if (!aIsPri && bIsPri) return 1;
    return 0;
  });

  container.innerHTML = sortedSources.map(src => {
    const isPriority = src.channel_id === PRIORITY_CHANNEL_ID;
    const regionBadge = regionColors[src.region] || regionColors['Chung'];
    const prices = src.prices || {};

    const priceChips = [
      { label: '1. Black Thorn', val: prices.black_thorn, bg: 'bg-rose-50 text-rose-900 font-bold border-rose-200' },
      { label: '2. Musang King', val: prices.musang_king, bg: 'bg-purple-50 text-purple-900 font-bold border-purple-200' },
      { label: '3. Sáu Hữu', val: prices.sau_huu, bg: 'bg-orange-50 text-orange-900 font-bold border-orange-200' },
      { label: '4. Thái Xô 8:2', val: prices.monthong_a, bg: 'bg-amber-50 text-amber-900 font-bold border-amber-200' },
      { label: 'Thái Xô 7:3', val: prices.monthong_b, bg: 'bg-amber-50/60 text-amber-800 border-amber-100' },
      { label: '5. Chuồng Bò', val: prices.chuong_bo, bg: 'bg-cyan-50 text-cyan-900 font-medium border-cyan-200' },
      { label: '6. Ri6 Xô 8:2', val: prices.ri6_a, bg: 'bg-emerald-50 text-emerald-800 font-bold border-emerald-200' },
      { label: 'Ri6 Xô 7:3', val: prices.ri6_b, bg: 'bg-emerald-50/60 text-emerald-800 border-emerald-100' },
    ].filter(p => p.val !== null && p.val !== undefined && p.val > 0);

    const cardBorder = isPriority 
      ? 'border-2 border-amber-400/90 shadow-md ring-2 ring-amber-100/80 bg-gradient-to-b from-amber-50/20 to-white' 
      : 'border border-slate-200 shadow-sm bg-white';

    return `
      <div class="${cardBorder} rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
          <!-- Header Card -->
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold px-2.5 py-1 rounded-full border ${regionBadge}">
                <i class="fa-solid fa-location-dot mr-1"></i> ${src.region || 'Toàn quốc'}
              </span>
              ${isPriority ? `
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 border border-amber-500 shadow-xs flex items-center gap-1">
                  <i class="fa-solid fa-star text-amber-950 text-[9px]"></i> Kênh Nguồn Ưu Tiên (@julitore18)
                </span>
              ` : ''}
            </div>
            <span class="text-[11px] text-slate-400 flex items-center gap-1">
              <i class="fa-regular fa-clock"></i>
              ${src.published_at ? new Date(src.published_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>

          <!-- Video Title & Channel -->
          <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-emerald-700 transition-colors">
            ${src.title}
          </h3>
          <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <i class="fa-brands fa-youtube text-red-500"></i>
            <span class="font-bold text-slate-700">${src.channel_name}</span>
          </div>

          <!-- AI Summary -->
          ${src.summary ? `
            <div class="mt-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100/80 text-xs text-slate-700 leading-relaxed">
              <span class="font-bold text-amber-900 flex items-center gap-1 mb-1">
                <i class="fa-solid fa-wand-magic-sparkles text-amber-600"></i> AI Tóm tắt thị trường xô tại vườn:
              </span>
              ${src.summary}
            </div>
          ` : ''}

          <!-- Bảng giá trích xuất -->
          <div class="mt-3">
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Bảng giá cắt xô trích xuất:</div>
            <div class="flex flex-wrap gap-1.5">
              ${priceChips.length > 0 ? priceChips.map(chip => `
                <span class="text-xs px-2.5 py-1 rounded-lg font-medium border border-slate-200/60 ${chip.bg}">
                  ${chip.label}: <strong>${new Intl.NumberFormat('vi-VN').format(chip.val)} đ</strong>
                </span>
              `).join('') : '<span class="text-xs text-slate-400 italic">Không có giá cụ thể</span>'}
            </div>
          </div>
        </div>

        <!-- Button Xem video -->
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
          <a href="${src.video_url}" target="_blank" rel="noopener noreferrer"
             class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs transition-colors">
            <i class="fa-brands fa-youtube text-red-600"></i> Xem video gốc
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}
