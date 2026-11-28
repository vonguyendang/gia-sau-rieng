/**
 * public/js/chart.js
 * Quản lý vẽ biểu đồ xu hướng Chart.js, bộ lọc thời gian và ẩn/hiện từng giống sầu riêng.
 */

let showForecastLines = true;

window.toggleForecastChartLines = function() {
  showForecastLines = !showForecastLines;
  const labelEl = document.getElementById('text-toggle-forecast-line');
  const btnEl = document.getElementById('btn-toggle-forecast-line');
  if (labelEl) {
    labelEl.textContent = `Nét đứt dự báo: ${showForecastLines ? 'BẬT' : 'TẮT'}`;
  }
  if (btnEl) {
    if (showForecastLines) {
      btnEl.className = 'px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg border border-amber-300 dark:border-amber-700/80 transition-all cursor-pointer active:scale-95 flex items-center gap-1';
    } else {
      btnEl.className = 'px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 flex items-center gap-1 opacity-70';
    }
  }
  initOrUpdateChart();
};

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

  const currentYear = new Date().getFullYear();
  const daysKeys = Object.keys(historyData.days)
    .filter(d => {
      const yr = parseInt(d.split('-')[0], 10);
      return !isNaN(yr) && yr >= 2024 && yr <= currentYear + 1;
    })
    .sort();
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

  let allDays = [...selectedDays];
  let forecastDays = [];

  // Tính toán các mốc ngày dự báo T+1, T+2, T+3 nếu bật chế độ nét đứt
  if (showForecastLines && typeof calculatePriceForecast === 'function' && selectedDays.length > 0) {
    const lastDayStr = selectedDays[selectedDays.length - 1];
    const lastDate = new Date(lastDayStr);
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + i);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      forecastDays.push(`${yyyy}-${mm}-${dd}`);
    }
    allDays = [...selectedDays, ...forecastDays];
  }

  const labels = allDays.map((d, idx) => {
    const isFc = idx >= selectedDays.length;
    return isFc ? `${formatDateStr(d)} (Dự báo)` : formatDateStr(d);
  });

  // Quản lý trạng thái hiển thị của từng giống sầu riêng:
  // - Lần đầu nạp: Mặc định chỉ hiển thị 2 giống chủ lực (0: Ri6, 1: Thái) để biểu đồ trên mobile thoáng đãng, sắc nét.
  // - Nếu người dùng đã tự bấm chọn giống trước đó: Giữ nguyên trạng thái lựa chọn của người dùng khi đổi mốc thời gian.
  const getHiddenState = (index) => {
    if (priceChartInstance) {
      return !priceChartInstance.isDatasetVisible(index);
    }
    // Mặc định: Ri6 và Thái hiển thị (false = not hidden), các giống phụ 2,3,4,5 tạm ẩn (true = hidden)
    return index > 1;
  };

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

  const buildSeriesData = (key, fcVarKey) => {
    const historical = selectedDays.map(d => getDayVal(d, key));
    if (!showForecastLines || forecastDays.length === 0) {
      return historical;
    }
    // Lấy giá trị dự báo từ calculatePriceForecast
    let fcDelta = 0;
    try {
      const fcData = calculatePriceForecast(currentRegion);
      if (fcData && fcData.forecasts) {
        const item = fcData.forecasts.find(f => f.keyMax === key || f.keyMin === key || f.name.toLowerCase().includes(fcVarKey));
        if (item) {
          fcDelta = item.projectedDelta3d || 0;
        }
      }
    } catch (e) {}

    const lastVal = historical[historical.length - 1];
    const fcPoints = [];
    if (lastVal !== null && lastVal !== undefined) {
      // T+1, T+2, T+3
      fcPoints.push(Math.round(lastVal + fcDelta * (1 / 3)));
      fcPoints.push(Math.round(lastVal + fcDelta * (2 / 3)));
      fcPoints.push(Math.round(lastVal + fcDelta));
    } else {
      fcPoints.push(null, null, null);
    }
    return [...historical, ...fcPoints];
  };

  const ri6Data = buildSeriesData('ri6_a', 'ri6');
  const monthongData = buildSeriesData('monthong_a', 'thái');
  const musangData = buildSeriesData('musang_king', 'musang');
  const blackThornData = buildSeriesData('black_thorn', 'black');
  const chuongBoData = buildSeriesData('chuong_bo', 'chuồng');
  const sauHuuData = buildSeriesData('sau_huu', 'sáu');

  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  const forecastStartIndex = selectedDays.length - 1;

  // Segment styling: nét liền cho quá khứ, nét đứt cho tương lai (dự báo)
  const segmentConfig = {
    borderDash: ctx => (ctx.p0DataIndex >= forecastStartIndex ? [5, 5] : undefined),
    borderWidth: ctx => (ctx.p0DataIndex >= forecastStartIndex ? 2 : 2.5),
  };

  const commonDatasetOpts = {
    tension: 0.35,
    pointRadius: 0,
    pointHitRadius: 20,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: '#ffffff',
    pointHoverBorderWidth: 2.5,
    spanGaps: true,
    segment: segmentConfig,
  };

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Ri6',
        data: ri6Data,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.06)',
        borderWidth: 2.5,
        fill: true,
        pointHoverBorderColor: '#059669',
        hidden: getHiddenState(0),
        ...commonDatasetOpts,
      },
      {
        label: 'Thái Monthong',
        data: monthongData,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.06)',
        borderWidth: 2.5,
        fill: true,
        pointHoverBorderColor: '#d97706',
        hidden: getHiddenState(1),
        ...commonDatasetOpts,
      },
      {
        label: 'Musang King',
        data: musangData,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.04)',
        borderWidth: 2,
        fill: false,
        pointHoverBorderColor: '#7c3aed',
        hidden: getHiddenState(2),
        ...commonDatasetOpts,
      },
      {
        label: 'Black Thorn',
        data: blackThornData,
        borderColor: '#e11d48',
        backgroundColor: 'rgba(225, 29, 72, 0.04)',
        borderWidth: 2,
        fill: false,
        pointHoverBorderColor: '#e11d48',
        hidden: getHiddenState(3),
        ...commonDatasetOpts,
      },
      {
        label: 'Chuồng Bò',
        data: chuongBoData,
        borderColor: '#0891b2',
        backgroundColor: 'rgba(8, 145, 178, 0.04)',
        borderWidth: 1.8,
        fill: false,
        pointHoverBorderColor: '#0891b2',
        hidden: getHiddenState(4),
        ...commonDatasetOpts,
      },
      {
        label: 'Sáu Hữu',
        data: sauHuuData,
        borderColor: '#ea580c',
        backgroundColor: 'rgba(234, 88, 12, 0.04)',
        borderWidth: 1.8,
        fill: false,
        pointHoverBorderColor: '#ea580c',
        hidden: getHiddenState(5),
        ...commonDatasetOpts,
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
            const isForecast = context.dataIndex >= selectedDays.length;
            const lbl = context.dataset.label || '';
            if (isForecast) {
              const val = context.parsed.y;
              return `${lbl} (Dự báo): ${val ? formatNumber(val) + ' đ' : '---'}`;
            }

            const dayKey = selectedDays[context.dataIndex];
            const dayObj = historyData.days[dayKey] || {};
            const avg = (currentRegion !== 'all' && dayObj.by_region?.[currentRegion])
              ? dayObj.by_region[currentRegion]
              : (dayObj.daily_average || {});

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
          font: { family: '"Be Vietnam Pro"', size: 10.5 },
          color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#cbd5e1' : '#64748b',
          maxTicksLimit: (typeof window !== 'undefined' && window.innerWidth < 640) ? 6 : (isDense ? 12 : 10),
          maxRotation: 0,
          autoSkip: true,
        }
      },
      y: {
        grid: { color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9' },
        ticks: {
          font: { family: '"Be Vietnam Pro"', size: 11 },
          color: (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? '#cbd5e1' : '#64748b',
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
      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-xs' 
      : 'bg-slate-100/80 dark:bg-slate-900/60 border-dashed border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-500 line-through opacity-50';
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

window.setChartPreset = function(preset) {
  if (!priceChartInstance) return;
  if (preset === 'main') {
    priceChartInstance.setDatasetVisibility(0, true);
    priceChartInstance.setDatasetVisibility(1, true);
    priceChartInstance.setDatasetVisibility(2, false);
    priceChartInstance.setDatasetVisibility(3, false);
    priceChartInstance.setDatasetVisibility(4, false);
    priceChartInstance.setDatasetVisibility(5, false);
  } else if (preset === 'all') {
    for (let i = 0; i <= 5; i++) {
      priceChartInstance.setDatasetVisibility(i, true);
    }
  }
  priceChartInstance.update();
  renderChartLegend();
};

function updateChart() {
  initOrUpdateChart();
}
