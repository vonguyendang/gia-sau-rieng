/**
 * public/app.js
 * Quản lý logic hiển thị dữ liệu giá sầu riêng, vẽ biểu đồ Chart.js và danh sách nguồn tin.
 */

let historyData = null;
let priceChartInstance = null;
let currentRange = '7'; // '7', '30', 'all'

// Định dạng số thành tiền tệ VNĐ
function formatVND(val) {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return 'Đang cập nhật';
  return new Intl.NumberFormat('vi-VN').format(val) + ' đ/kg';
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
    btn.addEventListener('click', (e) => {
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
    // Thêm timestamp để tránh cache trình duyệt
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
        class: 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full',
        icon: 'fa-arrow-trend-up'
      };
    } else if (diff < 0) {
      return {
        text: `${new Intl.NumberFormat('vi-VN').format(diff)} đ (${pct}%)`,
        class: 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full',
        icon: 'fa-arrow-trend-down'
      };
    }
    return {
      text: 'Đứng giá (0%)',
      class: 'text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full',
      icon: 'fa-equals'
    };
  }

  // 3 Thẻ giá chính
  const mainCardsConfig = [
    {
      title: 'Ri6 Loại A',
      sub: 'Trái tròn đẹp, từ 2.5 - 3 hộc trở lên',
      key: 'ri6_a',
      accentColor: 'border-l-4 border-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      icon: 'fa-solid fa-award',
    },
    {
      title: 'Monthong (Thái) Loại A',
      sub: 'Hàng xuất khẩu chuẩn cơm vàng ngọt',
      key: 'monthong_a',
      accentColor: 'border-l-4 border-amber-500',
      badgeColor: 'bg-amber-100 text-amber-900',
      icon: 'fa-solid fa-crown',
    },
    {
      title: 'Musang King',
      sub: 'Vua sầu riêng nhập khẩu / ghép tại vườn',
      key: 'musang_king',
      accentColor: 'border-l-4 border-purple-500',
      badgeColor: 'bg-purple-100 text-purple-900',
      icon: 'fa-solid fa-gem',
    }
  ];

  const mainContainer = document.getElementById('price-cards-container');
  if (mainContainer) {
    mainContainer.innerHTML = mainCardsConfig.map(c => {
      const val = todayAvg[c.key];
      const prevVal = prevAvg[c.key];
      const diffInfo = getDiff(val, prevVal);

      return `
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 ${c.accentColor} hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${c.badgeColor}">
              <i class="${c.icon} mr-1"></i> ${c.title}
            </span>
            <span class="text-[11px] font-medium text-slate-400">Giá TB hôm nay</span>
          </div>
          <div class="mt-2 flex items-baseline justify-between">
            <div class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              ${val ? new Intl.NumberFormat('vi-VN').format(val) : '<span class="text-slate-400 text-lg">Chưa có giá</span>'}
            </div>
            ${val ? '<span class="text-xs font-semibold text-slate-500">đ / kg</span>' : ''}
          </div>
          <div class="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
            <span class="text-slate-500">So với hôm qua:</span>
            <span class="font-semibold flex items-center gap-1 ${diffInfo.class}">
              <i class="fa-solid ${diffInfo.icon} text-[10px]"></i>
              ${diffInfo.text}
            </span>
          </div>
          <div class="mt-1 text-[11px] text-slate-400 truncate">
            ${c.sub}
          </div>
        </div>
      `;
    }).join('');
  }

  // 2 Thẻ phụ cho Loại B
  const subContainer = document.getElementById('price-subcards-container');
  if (subContainer) {
    const subCards = [
      { title: 'Ri6 Loại B (Dạt / Nhẹ cân)', key: 'ri6_b' },
      { title: 'Monthong Loại B (Dạt / Méo)', key: 'monthong_b' }
    ];

    subContainer.innerHTML = subCards.map(c => {
      const val = todayAvg[c.key];
      const prevVal = prevAvg[c.key];
      const diffInfo = getDiff(val, prevVal);

      return `
        <div class="bg-slate-100/80 rounded-xl p-3.5 px-4 flex items-center justify-between border border-slate-200 text-sm">
          <div>
            <div class="font-bold text-slate-800 text-xs sm:text-sm">${c.title}</div>
            <div class="text-xs font-medium ${diffInfo.class} mt-0.5 inline-block">
              <i class="fa-solid ${diffInfo.icon} text-[9px] mr-0.5"></i> ${diffInfo.text}
            </div>
          </div>
          <div class="text-right">
            <div class="text-base sm:text-lg font-extrabold text-emerald-800">
              ${val ? new Intl.NumberFormat('vi-VN').format(val) + ' đ/kg' : '---'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function initOrUpdateChart() {
  if (!historyData || !historyData.days) return;

  const daysKeys = Object.keys(historyData.days).sort();
  let selectedDays = daysKeys;

  if (currentRange === '7') {
    selectedDays = daysKeys.slice(-7);
  } else if (currentRange === '30') {
    selectedDays = daysKeys.slice(-30);
  }

  const labels = selectedDays.map(d => formatDateStr(d));
  const ri6Data = selectedDays.map(d => historyData.days[d]?.daily_average?.ri6_a ?? null);
  const monthongData = selectedDays.map(d => historyData.days[d]?.daily_average?.monthong_a ?? null);
  const musangData = selectedDays.map(d => historyData.days[d]?.daily_average?.musang_king ?? null);

  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Ri6 Loại A',
        data: ri6Data,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        spanGaps: true, // Không bị đứt đường khi có ngày null
        pointBackgroundColor: '#059669',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Monthong (Thái) A',
        data: monthongData,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        spanGaps: true,
        pointBackgroundColor: '#d97706',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Musang King',
        data: musangData,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        spanGaps: true,
        pointBackgroundColor: '#7c3aed',
        pointRadius: 4,
        pointHoverRadius: 6,
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
          padding: 18,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: '"Be Vietnam Pro"', size: 13, weight: '700' },
        bodyFont: { family: '"Be Vietnam Pro"', size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('vi-VN').format(context.parsed.y) + ' đ/kg';
            } else {
              label += 'Không có dữ liệu';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: '"Be Vietnam Pro"', size: 11 },
          color: '#64748b'
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

  // Phân loại màu cho từng khu vực
  const regionColors = {
    'Miền Tây': 'bg-blue-50 text-blue-700 border-blue-200',
    'Tây Nguyên': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Đông Nam Bộ': 'bg-amber-50 text-amber-700 border-amber-200',
    'Chung': 'bg-slate-100 text-slate-700 border-slate-200',
  };

  container.innerHTML = dayData.sources.map(src => {
    const regionBadge = regionColors[src.region] || regionColors['Chung'];
    const prices = src.prices || {};

    const priceChips = [
      { label: 'Ri6 A', val: prices.ri6_a, bg: 'bg-emerald-50 text-emerald-800' },
      { label: 'Ri6 B', val: prices.ri6_b, bg: 'bg-slate-50 text-slate-700' },
      { label: 'Monthong A', val: prices.monthong_a, bg: 'bg-amber-50 text-amber-900' },
      { label: 'Monthong B', val: prices.monthong_b, bg: 'bg-slate-50 text-slate-700' },
      { label: 'Musang King', val: prices.musang_king, bg: 'bg-purple-50 text-purple-900' },
      { label: 'Black Thorn (Gai Đen)', val: prices.black_thorn, bg: 'bg-stone-800 text-amber-300 border-stone-700' },
    ].filter(p => p.val !== null && p.val !== undefined && p.val > 0);

    return `
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
          <!-- Header Card -->
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full border ${regionBadge}">
              <i class="fa-solid fa-location-dot mr-1"></i> ${src.region || 'Toàn quốc'}
            </span>
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
            <span class="font-medium">${src.channel_name}</span>
          </div>

          <!-- AI Summary -->
          ${src.summary ? `
            <div class="mt-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100/80 text-xs text-slate-700 leading-relaxed">
              <span class="font-bold text-amber-900 flex items-center gap-1 mb-1">
                <i class="fa-solid fa-wand-magic-sparkles text-amber-600"></i> AI Tóm tắt thị trường:
              </span>
              ${src.summary}
            </div>
          ` : ''}

          <!-- Bảng giá trích xuất -->
          <div class="mt-3">
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Bảng giá trích xuất:</div>
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

