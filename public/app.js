/**
 * public/app.js
 * Quản lý logic hiển thị dữ liệu giá sầu riêng, vẽ biểu đồ Chart.js và danh sách nguồn tin.
 * Đảm bảo hiển thị đúng 6 giống theo đúng thứ tự yêu cầu:
 * 1. Sầu riêng Ri6
 * 2. Sầu riêng Thái (Monthong / Dona)
 * 3. Sầu riêng Musang King
 * 4. Sầu riêng Black Thorn (Gai Đen)
 * 5. Sầu riêng Chuồng Bò
 * 6. Sầu riêng Sáu Hữu
 * Không tự ý phân loại thêm các nhóm không có trong nguồn tin.
 */

let historyData = null;
let priceChartInstance = null;
let currentRange = '7'; // '7', '30', '90', '180', '365', 'all'
let currentRegion = 'all'; // 'all', 'mientay', 'miendong', 'taynguyen'
let currentSelectedDay = null;
const sourcesCache = {};
let isFullHistoryLoaded = false;

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

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

function setupEventListeners() {
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
      if (!historyData || !historyData.days) return;
      const daysKeys = Object.keys(historyData.days).sort().reverse();
      const idx = daysKeys.indexOf(currentSelectedDay);
      if (idx !== -1 && idx < daysKeys.length - 1) {
        selectDay(daysKeys[idx + 1]);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!historyData || !historyData.days) return;
      const daysKeys = Object.keys(historyData.days).sort().reverse();
      const idx = daysKeys.indexOf(currentSelectedDay);
      if (idx > 0) {
        selectDay(daysKeys[idx - 1]);
      }
    });
  }

  if (quickLatestBtn) {
    quickLatestBtn.addEventListener('click', () => {
      if (!historyData || !historyData.days) return;
      const daysKeys = Object.keys(historyData.days).sort().reverse();
      if (daysKeys.length > 0) {
        selectDay(daysKeys[0], true);
      }
    });
  }

  // Tương thích ngược nếu vẫn còn phần tử date-select cũ
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

  const dayObj = historyData.days[latestDay] || {};
  const prevDayObj = prevDay ? (historyData.days[prevDay] || {}) : {};

  // Lấy dữ liệu theo khu vực đang chọn (hoặc Toàn quốc)
  const todayAvg = (currentRegion !== 'all' && dayObj.by_region?.[currentRegion])
    ? dayObj.by_region[currentRegion]
    : (dayObj.daily_average || {});

  const prevAvg = (currentRegion !== 'all' && prevDayObj.by_region?.[currentRegion])
    ? prevDayObj.by_region[currentRegion]
    : (prevDayObj.daily_average || {});

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

  // 6 Giống sầu riêng đúng theo thứ tự người dùng yêu cầu:
  // 1. Sầu riêng Ri6 (Min - Max)
  // 2. Sầu riêng Thái (Monthong / Dona) (Min - Max)
  // 3. Sầu riêng Musang King
  // 4. Sầu riêng Black Thorn (Gai Đen) (Min - Max)
  // 5. Sầu riêng Chuồng Bò (Min - Max)
  // 6. Sầu riêng Sáu Hữu (Min - Max)
  const cardsConfig = [
    {
      orderNum: '1',
      title: 'Sầu riêng Ri6',
      tag: 'Xô tại vườn',
      keyMin: 'ri6_b',
      keyMax: 'ri6_a',
      accentColor: 'border-l-4 border-emerald-600',
      badgeColor: 'bg-emerald-100 text-emerald-900',
      icon: 'fa-solid fa-award',
      ratio: 'tỉ lệ 7:3 - 8:2'
    },
    {
      orderNum: '2',
      title: 'Sầu riêng Thái (Monthong / Dona)',
      tag: 'Xô tại vườn',
      keyMin: 'monthong_b',
      keyMax: 'monthong_a',
      accentColor: 'border-l-4 border-amber-500',
      badgeColor: 'bg-amber-100 text-amber-900',
      icon: 'fa-solid fa-crown',
      ratio: 'tỉ lệ 7:3 - 8:2'
    },
    {
      orderNum: '3',
      title: 'Sầu riêng Musang King',
      tag: 'Xô tại vườn',
      keyMin: 'musang_king',
      keyMax: 'musang_king',
      accentColor: 'border-l-4 border-purple-500',
      badgeColor: 'bg-purple-100 text-purple-900',
      icon: 'fa-solid fa-gem'
    },
    {
      orderNum: '4',
      title: 'Sầu riêng Black Thorn (Gai Đen)',
      tag: 'Xô tại vườn',
      keyMin: 'black_thorn',
      keyMax: 'black_thorn',
      accentColor: 'border-l-4 border-rose-500',
      badgeColor: 'bg-rose-100 text-rose-900',
      icon: 'fa-solid fa-fire'
    },
    {
      orderNum: '5',
      title: 'Sầu riêng Chuồng Bò',
      tag: 'Xô tại vườn',
      keyMin: 'chuong_bo',
      keyMax: 'chuong_bo',
      accentColor: 'border-l-4 border-cyan-600',
      badgeColor: 'bg-cyan-100 text-cyan-900',
      icon: 'fa-solid fa-leaf'
    },
    {
      orderNum: '6',
      title: 'Sầu riêng Sáu Hữu',
      tag: 'Xô tại vườn',
      keyMin: 'sau_huu',
      keyMax: 'sau_huu',
      accentColor: 'border-l-4 border-orange-500',
      badgeColor: 'bg-orange-100 text-orange-900',
      icon: 'fa-solid fa-star'
    }
  ];

  const mainContainer = document.getElementById('price-cards-container');
  if (!mainContainer) return;

  mainContainer.innerHTML = cardsConfig.map(c => {
    const minVal = todayAvg[c.keyMin] || todayAvg[c.keyMax];
    const maxVal = todayAvg[c.keyMax] || todayAvg[c.keyMin];
    const prevMax = prevAvg[c.keyMax] || prevAvg[c.keyMin];
    const diffInfo = getDiff(maxVal, prevMax);

    let priceDisplay = 'Đang cập nhật';
    let noteHtml = '';

    const regionLabel = currentRegion !== 'all' ? REGIONS[currentRegion]?.badge : null;

    if (minVal && maxVal) {
      if (minVal === maxVal) {
        priceDisplay = formatNumber(maxVal);
        noteHtml = `Giá thu mua xô tại vườn${regionLabel ? ` (${regionLabel})` : ''}: <strong>${formatNumber(maxVal)} đ/kg</strong>`;
      } else {
        priceDisplay = `${formatNumber(minVal)} – ${formatNumber(maxVal)}`;
        const ratioStr = c.ratio ? ` (${c.ratio})` : '';
        noteHtml = `Khoảng giá xô cả vườn${regionLabel ? ` (${regionLabel})` : ''}: <strong>Min ${formatNumber(minVal)}</strong> – <strong>Max ${formatNumber(maxVal)} đ/kg</strong>${ratioStr}`;
      }
    } else if (maxVal || minVal) {
      const val = maxVal || minVal;
      priceDisplay = formatNumber(val);
      noteHtml = `Giá thu mua xô tại vườn${regionLabel ? ` (${regionLabel})` : ''}: <strong>${formatNumber(val)} đ/kg</strong>`;
    } else {
      noteHtml = 'Đang theo dõi dữ liệu mới từ các vựa/thương lái.';
    }

    // Bảng giá chi tiết 3 khu vực khi người dùng chọn tab Toàn Quốc
    let regionalBreakdownHtml = '';
    if (currentRegion === 'all' && dayObj.by_region) {
      const mt = dayObj.by_region.mientay || {};
      const md = dayObj.by_region.miendong || {};
      const tn = dayObj.by_region.taynguyen || {};

      const formatRegPrice = (obj) => {
        const mn = obj[c.keyMin] || obj[c.keyMax];
        const mx = obj[c.keyMax] || obj[c.keyMin];
        if (!mn && !mx) return '---';
        if (mn === mx || !mn || !mx) return `${formatNumber(mx || mn)} đ`;
        return `${formatNumber(mn)} – ${formatNumber(mx)} đ`;
      };

      regionalBreakdownHtml = `
        <div class="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 text-[10.5px]">
          <span class="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md font-medium border border-blue-100/80 inline-flex items-center gap-1">
            <i class="fa-solid fa-water text-[9px] text-blue-600"></i> Miền Tây: <strong class="font-bold">${formatRegPrice(mt)}</strong>
          </span>
          <span class="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-medium border border-emerald-100/80 inline-flex items-center gap-1">
            <i class="fa-solid fa-tree text-[9px] text-emerald-600"></i> Miền Đông: <strong class="font-bold">${formatRegPrice(md)}</strong>
          </span>
          <span class="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-medium border border-amber-100/80 inline-flex items-center gap-1">
            <i class="fa-solid fa-mountain text-[9px] text-amber-600"></i> Tây Nguyên: <strong class="font-bold">${formatRegPrice(tn)}</strong>
          </span>
        </div>
      `;
    }

    const tagBadge = currentRegion !== 'all'
      ? `<span class="text-[10px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 whitespace-nowrap"><i class="fa-solid fa-location-dot text-emerald-600 mr-1"></i>${REGIONS[currentRegion]?.badge || currentRegion}</span>`
      : `<span class="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0 whitespace-nowrap">${c.tag}</span>`;

    return `
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 ${c.accentColor} hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-1.5 mb-2">
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${c.badgeColor} flex items-center gap-1.5 leading-snug">
              <i class="${c.icon} shrink-0"></i> <span>${c.orderNum}. ${c.title}</span>
            </span>
            ${tagBadge}
          </div>

          <div class="mt-2.5 flex items-baseline justify-between">
            <div>
              <span class="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase block tracking-wider">Khoảng giá xô vườn:</span>
              <div class="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-none mt-1">
                ${priceDisplay}
              </div>
            </div>
            <span class="text-xs font-bold text-slate-500 shrink-0">đ / kg</span>
          </div>

          <div class="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600">
            <i class="fa-solid fa-circle-info text-slate-400 mr-1"></i> ${noteHtml}
            ${regionalBreakdownHtml}
          </div>
        </div>

        <div>
          <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span class="text-slate-500 text-[11px]">So với hôm qua:</span>
            <span class="font-bold text-[11px] flex items-center gap-1 ${diffInfo.class} whitespace-nowrap">
              <i class="fa-solid ${diffInfo.icon} text-[9px]"></i>
              ${diffInfo.text}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderComparisonTable() {
  if (!historyData || !historyData.days) return;

  const tableBody = document.getElementById('comparison-table-body');
  if (!tableBody) return;

  const daysKeys = Object.keys(historyData.days).sort();
  if (daysKeys.length === 0) return;

  const latestDay = daysKeys[daysKeys.length - 1];
  const dayObj = historyData.days[latestDay] || {};
  const todayAvg = (currentRegion !== 'all' && dayObj.by_region?.[currentRegion])
    ? dayObj.by_region[currentRegion]
    : (dayObj.daily_average || {});

  function getPastDay(daysAgo) {
    const curDate = new Date(latestDay);
    curDate.setDate(curDate.getDate() - daysAgo);
    const targetStr = curDate.toISOString().split('T')[0];
    
    if (historyData.days[targetStr]) return targetStr;

    for (let delta = 1; delta <= 3; delta++) {
      const dPlus = new Date(curDate);
      dPlus.setDate(dPlus.getDate() + delta);
      const strPlus = dPlus.toISOString().split('T')[0];
      if (historyData.days[strPlus]) return strPlus;

      const dMinus = new Date(curDate);
      dMinus.setDate(dMinus.getDate() - delta);
      const strMinus = dMinus.toISOString().split('T')[0];
      if (historyData.days[strMinus]) return strMinus;
    }
    return null;
  }

  const t1Key = daysKeys.length > 1 ? daysKeys[daysKeys.length - 2] : null;
  const t7Key = getPastDay(7);
  const t30Key = getPastDay(30);
  const tYoYKey = getPastDay(365);

  function getPastAvg(pastKey) {
    if (!pastKey || !historyData.days[pastKey]) return null;
    const pObj = historyData.days[pastKey];
    return (currentRegion !== 'all' && pObj.by_region?.[currentRegion])
      ? pObj.by_region[currentRegion]
      : (pObj.daily_average || null);
  }

  const t1Avg = getPastAvg(t1Key);
  const t7Avg = getPastAvg(t7Key);
  const t30Avg = getPastAvg(t30Key);
  const tYoYAvg = getPastAvg(tYoYKey);

  function formatDiffCell(todayVal, pastVal) {
    if (!todayVal || !pastVal) {
      return '<span class="text-slate-400 text-xs italic bg-slate-50 px-2 py-0.5 rounded border border-slate-100 whitespace-nowrap">Đang tích lũy</span>';
    }
    const diff = todayVal - pastVal;
    const pct = ((diff / pastVal) * 100).toFixed(1);
    if (diff > 0) {
      return `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-xs inline-flex items-center gap-1 border border-emerald-200 whitespace-nowrap"><i class="fa-solid fa-arrow-trend-up text-[10px]"></i> +${new Intl.NumberFormat('vi-VN').format(diff)} đ (+${pct}%)</span>`;
    } else if (diff < 0) {
      return `<span class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold text-xs inline-flex items-center gap-1 border border-rose-200 whitespace-nowrap"><i class="fa-solid fa-arrow-trend-down text-[10px]"></i> ${new Intl.NumberFormat('vi-VN').format(diff)} đ (${pct}%)</span>`;
    }
    return '<span class="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium text-xs whitespace-nowrap">Đứng giá</span>';
  }

  const items = [
    {
      name: '1. Sầu riêng Ri6',
      icon: 'fa-award text-emerald-600',
      todayDisplay: (todayAvg.ri6_b && todayAvg.ri6_a) ? `${formatNumber(todayAvg.ri6_b)} – ${formatNumber(todayAvg.ri6_a)} đ` : (todayAvg.ri6_a ? `${formatNumber(todayAvg.ri6_a)} đ` : '---'),
      val: todayAvg.ri6_a,
      t1Val: t1Avg?.ri6_a,
      t7Val: t7Avg?.ri6_a,
      t30Val: t30Avg?.ri6_a,
      tYoYVal: tYoYAvg?.ri6_a,
    },
    {
      name: '2. Sầu riêng Thái (Monthong / Dona)',
      icon: 'fa-crown text-amber-500',
      todayDisplay: (todayAvg.monthong_b && todayAvg.monthong_a) ? `${formatNumber(todayAvg.monthong_b)} – ${formatNumber(todayAvg.monthong_a)} đ` : (todayAvg.monthong_a ? `${formatNumber(todayAvg.monthong_a)} đ` : '---'),
      val: todayAvg.monthong_a,
      t1Val: t1Avg?.monthong_a,
      t7Val: t7Avg?.monthong_a,
      t30Val: t30Avg?.monthong_a,
      tYoYVal: tYoYAvg?.monthong_a,
    },
    {
      name: '3. Sầu riêng Musang King',
      icon: 'fa-gem text-purple-600',
      todayDisplay: todayAvg.musang_king ? `${formatNumber(todayAvg.musang_king)} đ` : '---',
      val: todayAvg.musang_king,
      t1Val: t1Avg?.musang_king,
      t7Val: t7Avg?.musang_king,
      t30Val: t30Avg?.musang_king,
      tYoYVal: tYoYAvg?.musang_king,
    },
    {
      name: '4. Sầu riêng Black Thorn (Gai Đen)',
      icon: 'fa-fire text-rose-600',
      todayDisplay: todayAvg.black_thorn ? `${formatNumber(todayAvg.black_thorn)} đ` : '---',
      val: todayAvg.black_thorn,
      t1Val: t1Avg?.black_thorn,
      t7Val: t7Avg?.black_thorn,
      t30Val: t30Avg?.black_thorn,
      tYoYVal: tYoYAvg?.black_thorn,
    },
    {
      name: '5. Sầu riêng Chuồng Bò',
      icon: 'fa-leaf text-cyan-600',
      todayDisplay: todayAvg.chuong_bo ? `${formatNumber(todayAvg.chuong_bo)} đ` : '---',
      val: todayAvg.chuong_bo,
      t1Val: t1Avg?.chuong_bo,
      t7Val: t7Avg?.chuong_bo,
      t30Val: t30Avg?.chuong_bo,
      tYoYVal: tYoYAvg?.chuong_bo,
    },
    {
      name: '6. Sầu riêng Sáu Hữu',
      icon: 'fa-star text-orange-500',
      todayDisplay: todayAvg.sau_huu ? `${formatNumber(todayAvg.sau_huu)} đ` : '---',
      val: todayAvg.sau_huu,
      t1Val: t1Avg?.sau_huu,
      t7Val: t7Avg?.sau_huu,
      t30Val: t30Avg?.sau_huu,
      tYoYVal: tYoYAvg?.sau_huu,
    }
  ];

  tableBody.innerHTML = items.map(item => `
    <tr class="hover:bg-slate-50/80 transition-colors">
      <td class="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">
        <span class="inline-flex items-center gap-1.5"><i class="fa-solid ${item.icon}"></i> ${item.name}</span>
      </td>
      <td class="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">${item.todayDisplay}</td>
      <td class="py-3 px-3 whitespace-nowrap">${formatDiffCell(item.val, item.t1Val)}</td>
      <td class="py-3 px-3 whitespace-nowrap">${formatDiffCell(item.val, item.t7Val)}</td>
      <td class="py-3 px-3 whitespace-nowrap">${formatDiffCell(item.val, item.t30Val)}</td>
      <td class="py-3 px-3.5 whitespace-nowrap">${formatDiffCell(item.val, item.tYoYVal)}</td>
    </tr>
  `).join('');
}

async function ensureFullHistoryLoaded() {
  if (isFullHistoryLoaded) return;
  try {
    const res = await fetch(`data/history.json?t=${Date.now()}`);
    if (res.ok) {
      const fullData = await res.json();
      if (fullData && fullData.days) {
        historyData.days = { ...fullData.days, ...historyData.days };
        historyData.is_partial = false;
        isFullHistoryLoaded = true;
        initOrUpdateChart();
      }
    }
  } catch (e) {
    console.warn('Không thể tải toàn bộ lịch sử:', e);
  }
}

function initOrUpdateChart() {
  if (!historyData || !historyData.days) return;

  // Nếu người dùng chọn xem khoảng thời gian dài (3 tháng, 6 tháng, 1 năm, Tất cả) mà dữ liệu hiện tại chỉ là partial 35 ngày
  if (['90', '180', '365', 'all'].includes(currentRange) && historyData.is_partial && !isFullHistoryLoaded) {
    ensureFullHistoryLoaded();
  }

  const daysKeys = Object.keys(historyData.days).sort();
  let selectedDays = daysKeys;

  if (currentRange === '7') {
    selectedDays = daysKeys.slice(-7);
  } else if (currentRange === '30') {
    selectedDays = daysKeys.slice(-30);
  } else if (currentRange === '90') {
    selectedDays = daysKeys.slice(-90);
  } else if (currentRange === '180') {
    selectedDays = daysKeys.slice(-180);
  } else if (currentRange === '365') {
    selectedDays = daysKeys.slice(-365);
  } else {
    selectedDays = daysKeys;
  }

  const isDense = selectedDays.length > 60;
  const pRadius = isDense ? 0 : 4;
  const pHoverRadius = isDense ? 5 : 7;
  const bWidth = isDense ? 2 : 2.5;

  const labels = selectedDays.map(d => formatDateStr(d));

  // 6 Giống đúng thứ tự:
  // 1. Sầu riêng Ri6
  // 2. Sầu riêng Thái (Monthong / Dona)
  // 3. Sầu riêng Musang King
  // 4. Sầu riêng Black Thorn (Gai Đen)
  // 5. Sầu riêng Chuồng Bò
  // 6. Sầu riêng Sáu Hữu
  const getDayVal = (d, key) => {
    if (currentRegion !== 'all' && historyData.days[d]?.by_region?.[currentRegion]) {
      return historyData.days[d].by_region[currentRegion]?.[key] ?? null;
    }
    return historyData.days[d]?.daily_average?.[key] ?? null;
  };

  const ri6Data = selectedDays.map(d => getDayVal(d, 'ri6_a'));
  const monthongData = selectedDays.map(d => getDayVal(d, 'monthong_a'));
  const musangData = selectedDays.map(d => getDayVal(d, 'musang_king'));
  const blackThornData = selectedDays.map(d => getDayVal(d, 'black_thorn'));
  const chuongBoData = selectedDays.map(d => getDayVal(d, 'chuong_bo'));
  const sauHuuData = selectedDays.map(d => getDayVal(d, 'sau_huu'));

  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Ri6',
        data: ri6Data,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.08)',
        borderWidth: bWidth,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#059669',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: 'Thái Monthong',
        data: monthongData,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.08)',
        borderWidth: bWidth,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#d97706',
        pointRadius: pRadius,
        pointHoverRadius: pHoverRadius,
      },
      {
        label: 'Musang King',
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
        label: 'Black Thorn',
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
        label: 'Chuồng Bò',
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
        label: 'Sáu Hữu',
        data: sauHuuData,
        borderColor: '#ea580c',
        borderWidth: isDense ? 1.5 : 2,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointBackgroundColor: '#ea580c',
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
        display: false, // TẮT legend mặc định trên canvas để dọn sạch 100% không gian, không che khuất đường vẽ
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleFont: { family: '"Be Vietnam Pro"', size: 11, weight: '700' },
        bodyFont: { family: '"Be Vietnam Pro"', size: 10.5 },
        padding: 8,
        cornerRadius: 8,
        boxWidth: 6,
        boxHeight: 6,
        callbacks: {
          title: function(items) {
            const regBadge = currentRegion !== 'all' ? REGIONS[currentRegion]?.badge : 'Toàn quốc';
            return items[0] ? `Ngày ${items[0].label} (${regBadge} - xô tại vườn)` : '';
          },
          label: function(context) {
            const dayKey = selectedDays[context.dataIndex];
            const dayObj = historyData.days[dayKey] || {};
            const avg = (currentRegion !== 'all' && dayObj.by_region?.[currentRegion])
              ? dayObj.by_region[currentRegion]
              : (dayObj.daily_average || {});
            const lbl = context.dataset.label || '';

            if (lbl.includes('Ri6')) {
              const low = avg.ri6_b ? formatNumber(avg.ri6_b) : (avg.ri6_a ? formatNumber(avg.ri6_a) : '---');
              const high = avg.ri6_a ? formatNumber(avg.ri6_a) : '---';
              return (low !== high && low !== '---') ? `Ri6: ${low} – ${high} đ` : `Ri6: ${high} đ`;
            }

            if (lbl.includes('Thái')) {
              const low = avg.monthong_b ? formatNumber(avg.monthong_b) : (avg.monthong_a ? formatNumber(avg.monthong_a) : '---');
              const high = avg.monthong_a ? formatNumber(avg.monthong_a) : '---';
              return (low !== high && low !== '---') ? `Thái: ${low} – ${high} đ` : `Thái: ${high} đ`;
            }

            if (context.parsed.y !== null) {
              return `${lbl}: ${formatNumber(context.parsed.y)} đ`;
            }
            return `${lbl}: ---`;
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

  renderChartLegend();
}

function renderChartLegend() {
  const container = document.getElementById('chart-legend-container');
  if (!container || !priceChartInstance) return;

  const metaList = [
    { label: '1. Ri6', color: '#059669', index: 0 },
    { label: '2. Thái Monthong', color: '#d97706', index: 1 },
    { label: '3. Musang King', color: '#7c3aed', index: 2 },
    { label: '4. Black Thorn', color: '#e11d48', index: 3 },
    { label: '5. Chuồng Bò', color: '#0891b2', index: 4 },
    { label: '6. Sáu Hữu', color: '#ea580c', index: 5 },
  ];

  container.innerHTML = metaList.map(item => {
    const isVisible = priceChartInstance.isDatasetVisible(item.index);
    const stateClass = isVisible 
      ? 'bg-slate-50 border-slate-200/90 text-slate-800 shadow-xs' 
      : 'bg-slate-100/80 border-dashed border-slate-300 text-slate-400 line-through opacity-50';
    return `
      <button type="button" onclick="toggleDataset(${item.index})" class="px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${stateClass}">
        <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${item.color}"></span>
        <span class="truncate">${item.label}</span>
      </button>
    `;
  }).join('');
}

window.toggleDataset = function(index) {
  if (!priceChartInstance) return;
  const isVisible = priceChartInstance.isDatasetVisible(index);
  priceChartInstance.setDatasetVisibility(index, !isVisible);
  priceChartInstance.update();
  renderChartLegend();
};

function updateChart() {
  initOrUpdateChart();
}

function populateDateSelect() {
  if (!historyData) return;

  const daysKeys = historyData.available_days || (historyData.days ? Object.keys(historyData.days).sort().reverse() : []);
  if (daysKeys.length === 0) return;

  // Cập nhật tổng số ngày lên popover header
  const totalDaysEl = document.getElementById('popover-total-days');
  if (totalDaysEl) {
    totalDaysEl.textContent = `${daysKeys.length} ngày`;
  }

  // Tương thích ngược: nếu có select cũ
  const dateSelect = document.getElementById('date-select');
  if (dateSelect) {
    dateSelect.innerHTML = daysKeys.map(d => {
      return `<option value="${d}">${formatDateStr(d, true)}</option>`;
    }).join('');
  }

  // Mặc định chọn ngày mới nhất nếu chưa chọn
  if (!currentSelectedDay || !daysKeys.includes(currentSelectedDay)) {
    currentSelectedDay = daysKeys[0];
  }

  renderDateGrid(daysKeys);
  selectDay(currentSelectedDay, false);
}

function renderDateGrid(daysKeys) {
  const gridContainer = document.getElementById('date-grid-container');
  if (!gridContainer) return;

  // Phân nhóm theo Năm-Tháng (YYYY-MM)
  const monthGroups = {};
  daysKeys.forEach(d => {
    const ym = d.substring(0, 7);
    if (!monthGroups[ym]) monthGroups[ym] = [];
    monthGroups[ym].push(d);
  });

  const latestDay = daysKeys[0];

  let html = '';
  Object.keys(monthGroups).forEach(ym => {
    const [year, month] = ym.split('-');
    const monthLabel = `Tháng ${parseInt(month, 10)}/${year}`;
    const daysInMonth = monthGroups[ym];

    html += `
      <div class="month-group">
        <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span class="flex items-center gap-1.5"><i class="fa-regular fa-calendar text-emerald-600"></i> ${monthLabel}</span>
          <span class="text-[10px] text-slate-400 font-semibold">(${daysInMonth.length} ngày)</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${daysInMonth.map(d => {
            const isSelected = d === currentSelectedDay;
            const isLatest = d === latestDay;
            const weekday = getWeekdayShort(d);
            const parts = d.split('-');
            const displayDayMonth = `${parts[2]}/${parts[1]}`;
            const knownSources = (historyData.days && historyData.days[d]?.sources) || sourcesCache[d];
            const sourceCount = knownSources ? knownSources.length : null;

            const baseClass = isSelected
              ? 'bg-emerald-700 text-white font-bold border-emerald-700 shadow-sm ring-2 ring-emerald-300'
              : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300 font-medium';

            const subTextClass = isSelected ? 'text-emerald-100' : 'text-slate-400';
            const countClass = isSelected ? 'text-emerald-100' : 'text-slate-500';

            return `
              <button type="button" 
                data-day="${d}"
                class="date-grid-chip p-2 rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer ${baseClass}">
                <div class="flex items-center justify-between w-full">
                  <span class="text-xs font-bold">${displayDayMonth}</span>
                  <span class="text-[10px] ${subTextClass}">${weekday}</span>
                </div>
                <div class="mt-1 flex items-center justify-between w-full text-[10px]">
                  <span class="${countClass}">${sourceCount > 0 ? `${sourceCount} tin` : '0 tin'}</span>
                  ${isLatest ? `<span class="text-[9px] px-1 py-0.2 rounded font-bold ${isSelected ? 'bg-amber-300 text-amber-950' : 'bg-emerald-100 text-emerald-800'}">Mới</span>` : ''}
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  gridContainer.innerHTML = html;

  // Gắn sự kiện click cho từng ô chip ngày
  const chips = gridContainer.querySelectorAll('.date-grid-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const day = chip.getAttribute('data-day');
      if (day) selectDay(day, true);
    });
  });
}

function selectDay(dayKey, closePopover = false) {
  if (!historyData) return;
  const daysKeys = historyData.available_days || (historyData.days ? Object.keys(historyData.days).sort().reverse() : []);
  if (!daysKeys.includes(dayKey)) return;

  currentSelectedDay = dayKey;
  const latestDay = daysKeys[0];
  const isLatest = dayKey === latestDay;
  const weekday = getWeekdayShort(dayKey);

  // Cập nhật text nút toggle
  const selectedTextEl = document.getElementById('selected-date-text');
  const badgeEl = document.getElementById('selected-date-badge');
  if (selectedTextEl) {
    selectedTextEl.textContent = `${formatDateStr(dayKey, true)} (${weekday})`;
  }
  if (badgeEl) {
    if (isLatest) {
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  // Tương thích ngược: cập nhật select cũ nếu có
  const dateSelect = document.getElementById('date-select');
  if (dateSelect && dateSelect.value !== dayKey) {
    dateSelect.value = dayKey;
  }

  // Cập nhật trạng thái nút Previous / Next
  const prevBtn = document.getElementById('btn-prev-day');
  const nextBtn = document.getElementById('btn-next-day');
  const idx = daysKeys.indexOf(dayKey);

  if (prevBtn) {
    // idx === daysKeys.length - 1 nghĩa là ngày cũ nhất -> disable prev
    prevBtn.disabled = (idx >= daysKeys.length - 1);
  }
  if (nextBtn) {
    // idx === 0 nghĩa là ngày mới nhất -> disable next
    nextBtn.disabled = (idx <= 0);
  }

  // Cập nhật highlight active trong grid
  const gridContainer = document.getElementById('date-grid-container');
  if (gridContainer) {
    const chips = gridContainer.querySelectorAll('.date-grid-chip');
    chips.forEach(chip => {
      const d = chip.getAttribute('data-day');
      const isSel = d === dayKey;
      const isLat = d === latestDay;
      const subText = chip.querySelector('span:nth-child(2)');
      const countEl = chip.querySelector('.mt-1 > span:first-child');
      const badgeSpan = chip.querySelector('.mt-1 > span:last-child');

      if (isSel) {
        chip.className = 'date-grid-chip p-2 rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer bg-emerald-700 text-white font-bold border-emerald-700 shadow-sm ring-2 ring-emerald-300';
        if (subText) subText.className = 'text-[10px] text-emerald-100';
        if (countEl) countEl.className = 'text-emerald-100';
        if (badgeSpan && isLat) badgeSpan.className = 'text-[9px] px-1 py-0.2 rounded font-bold bg-amber-300 text-amber-950';
      } else {
        chip.className = 'date-grid-chip p-2 rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300 font-medium';
        if (subText) subText.className = 'text-[10px] text-slate-400';
        if (countEl) countEl.className = 'text-slate-500';
        if (badgeSpan && isLat) badgeSpan.className = 'text-[9px] px-1 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800';
      }
    });
  }

  // Đóng popover nếu yêu cầu
  if (closePopover) {
    const popover = document.getElementById('date-picker-popover');
    const arrow = document.getElementById('date-picker-arrow');
    if (popover) popover.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
  }

  // Render danh sách nguồn tin của ngày đã chọn (tải động)
  renderSources(dayKey);
}

function renderSources(selectedDay) {
  const container = document.getElementById('sources-list-container');
  if (!container) return;

  // 1. Kiểm tra cache bộ nhớ
  if (sourcesCache[selectedDay]) {
    renderSourcesCards(container, sourcesCache[selectedDay]);
    return;
  }

  // 2. Kiểm tra nếu có sẵn trong historyData.days
  if (historyData?.days?.[selectedDay]?.sources && historyData.days[selectedDay].sources.length > 0) {
    sourcesCache[selectedDay] = historyData.days[selectedDay].sources;
    renderSourcesCards(container, sourcesCache[selectedDay]);
    return;
  }

  // 3. Tải động từ public/data/sources/{date}.json (Giải pháp 2: Tách nguồn theo ngày)
  container.innerHTML = `
    <div class="col-span-full bg-white p-10 rounded-2xl text-center border border-slate-200">
      <i class="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600 mb-2"></i>
      <div class="text-xs font-semibold text-slate-600">Đang tải bản tin ngày ${formatDateStr(selectedDay, true)}...</div>
    </div>
  `;

  fetch(`data/sources/${selectedDay}.json?t=${Date.now()}`)
    .then(res => {
      if (!res.ok) throw new Error('Không tìm thấy file nguồn');
      return res.json();
    })
    .then(sources => {
      sourcesCache[selectedDay] = Array.isArray(sources) ? sources : [];
      renderSourcesCards(container, sourcesCache[selectedDay]);
    })
    .catch(() => {
      renderSourcesCards(container, []);
    });
}

function renderSourcesCards(container, sources) {
  if (!sources || sources.length === 0) {
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

  const sortedSources = [...sources].sort((a, b) => {
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
      { label: '1. Sầu riêng Ri6', min: prices.ri6_b, max: prices.ri6_a, bg: 'bg-emerald-50 text-emerald-800 font-bold border-emerald-200' },
      { label: '2. Sầu riêng Thái', min: prices.monthong_b, max: prices.monthong_a, bg: 'bg-amber-50 text-amber-900 font-bold border-amber-200' },
      { label: '3. Musang King', min: prices.musang_king, max: prices.musang_king, bg: 'bg-purple-50 text-purple-900 font-bold border-purple-200' },
      { label: '4. Black Thorn', min: prices.black_thorn, max: prices.black_thorn, bg: 'bg-rose-50 text-rose-900 font-bold border-rose-200' },
      { label: '5. Chuồng Bò', min: prices.chuong_bo, max: prices.chuong_bo, bg: 'bg-cyan-50 text-cyan-900 font-medium border-cyan-200' },
      { label: '6. Sáu Hữu', min: prices.sau_huu, max: prices.sau_huu, bg: 'bg-orange-50 text-orange-900 font-bold border-orange-200' },
    ].map(p => {
      const minV = p.min;
      const maxV = p.max;
      if (!minV && !maxV) return null;
      let text = '';
      if (minV && maxV && minV !== maxV) {
        text = `${formatNumber(minV)} – ${formatNumber(maxV)} đ`;
      } else {
        text = `${formatNumber(maxV || minV)} đ`;
      }
      return { label: p.label, val: text, bg: p.bg };
    }).filter(Boolean);

    const cardBorder = isPriority 
      ? 'border-2 border-amber-400/90 shadow-md ring-2 ring-amber-100/80 bg-gradient-to-b from-amber-50/20 to-white' 
      : 'border border-slate-200 shadow-sm bg-white';

    return `
      <div class="${cardBorder} rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
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

          <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-emerald-700 transition-colors">
            ${src.title}
          </h3>
          <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <i class="fa-brands fa-youtube text-red-500"></i>
            <span class="font-bold text-slate-700">${src.channel_name}</span>
          </div>

          ${src.summary ? `
            <div class="mt-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100/80 text-xs text-slate-700 leading-relaxed">
              <span class="font-bold text-amber-900 flex items-center gap-1 mb-1">
                <i class="fa-solid fa-wand-magic-sparkles text-amber-600"></i> Tóm tắt bản tin xô tại vườn:
              </span>
              ${src.summary}
            </div>
          ` : ''}

          <div class="mt-3">
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Giá xô trích xuất từ video:</div>
            <div class="flex flex-wrap gap-1.5">
              ${priceChips.length > 0 ? priceChips.map(chip => `
                <span class="text-xs px-2.5 py-1 rounded-lg font-medium border border-slate-200/60 ${chip.bg}">
                  ${chip.label}: <strong>${chip.val}</strong>
                </span>
              `).join('') : '<span class="text-xs text-slate-400 italic">Không có giá cụ thể</span>'}
            </div>
          </div>
        </div>

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
