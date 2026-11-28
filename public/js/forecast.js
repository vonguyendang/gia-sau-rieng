/**
 * public/js/forecast.js
 * Mô hình Dự Báo Xu Hướng Giá Sầu Riêng 3 - 5 Ngày Tới.
 * 
 * NGUYÊN TẮC THIẾT KẾ:
 * 1. 100% Client-side (0-đ chi phí máy chủ / API).
 * 2. Phân tích kết hợp (Hybrid Quantitative + Qualitative Analysis):
 *    - Định lượng: Tính đường trượt động lượng (Linear Regression / SMA momentum) dựa trên lịch sử giá 7-14 ngày gần nhất.
 *    - Định tính: Tổng hợp cảm quan thị trường (trader market sentiment) từ các video tin tức YouTube được AI trích xuất.
 * 3. Bảo vệ biên độ dự báo: Giới hạn biên độ biến động hợp lý (tránh ngoại lai do nhiễu ngắn hạn).
 */

// Bộ đệm kết quả tính toán dự báo
let currentForecastResults = null;

/**
 * Tính toán dự báo xu hướng giá cho tất cả các giống sầu riêng
 * @param {string} region Khu vực được chọn ('all', 'mientay', 'miendong', 'taynguyen')
 * @returns {Object} Kết quả dự báo
 */
function calculatePriceForecast(region = 'all') {
  if (!historyData || !historyData.days) return null;

  const dayKeys = Object.keys(historyData.days)
    .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();

  if (dayKeys.length < 3) return null;

  // Lấy tối đa 14 ngày gần nhất để tính động lượng ngắn hạn
  const recentDays = dayKeys.slice(-14);
  const latestDayKey = recentDays[recentDays.length - 1];
  const latestDayData = historyData.days[latestDayKey];

  // Thu thập các ý kiến thị trường từ các nguồn tin trong 3 ngày gần nhất
  const sentimentSources = [];
  const last3Days = dayKeys.slice(-3);
  last3Days.forEach(dk => {
    const dayObj = historyData.days[dk];
    if (dayObj && Array.isArray(dayObj.sources)) {
      dayObj.sources.forEach(s => {
        if (s.market_sentiment && s.market_sentiment !== 'chua_ro') {
          sentimentSources.push(s);
        }
      });
    }
  });

  // Đếm xu hướng định tính
  let tangCount = 0;
  let onDinhCount = 0;
  let giamCount = 0;
  sentimentSources.forEach(s => {
    if (s.market_sentiment === 'tang') tangCount++;
    else if (s.market_sentiment === 'giam') giamCount++;
    else if (s.market_sentiment === 'on_dinh') onDinhCount++;
  });

  const varieties = [
    { keyMin: 'ri6_b', keyMax: 'ri6_a', name: 'Ri6 Xô', color: 'emerald', icon: 'fa-award' },
    { keyMin: 'monthong_b', keyMax: 'monthong_a', name: 'Thái (Monthong) Xô', color: 'amber', icon: 'fa-crown' },
    { keyMin: 'musang_king', keyMax: 'musang_king', name: 'Musang King', color: 'purple', icon: 'fa-gem' },
    { keyMin: 'black_thorn', keyMax: 'black_thorn', name: 'Black Thorn', color: 'rose', icon: 'fa-fire' },
    { keyMin: 'chuong_bo', keyMax: 'chuong_bo', name: 'Chuồng Bò', color: 'cyan', icon: 'fa-leaf' },
    { keyMin: 'sau_huu', keyMax: 'sau_huu', name: 'Sáu Hữu', color: 'orange', icon: 'fa-star' }
  ];

  const forecasts = [];

  varieties.forEach(v => {
    const historySeries = [];
    recentDays.forEach(dk => {
      const d = historyData.days[dk];
      let pObj = d.daily_average || {};
      if (region !== 'all' && d.by_region && d.by_region[region]) {
        pObj = d.by_region[region];
      }
      const minVal = pObj[v.keyMin];
      const maxVal = pObj[v.keyMax];
      if (minVal || maxVal) {
        const mid = ((minVal || maxVal) + (maxVal || minVal)) / 2;
        historySeries.push({ date: dk, min: minVal || maxVal, max: maxVal || minVal, mid });
      }
    });

    if (historySeries.length === 0) return;

    const currentItem = historySeries[historySeries.length - 1];
    const n = historySeries.length;

    // Tính độ dốc tuyến tính (Linear Regression Slope) trên mid giá
    let slope = 0;
    if (n >= 3) {
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        const x = i;
        const y = historySeries[i].mid;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }
      slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    // Tác động của cảm quan thương lái (Sentiment impact: điều chỉnh nhẹ độ dốc)
    let sentimentFactor = 0;
    if (tangCount > giamCount) sentimentFactor = 300;
    else if (giamCount > tangCount) sentimentFactor = -300;

    const adjustedDailySlope = slope + sentimentFactor;

    // Phân loại xu hướng
    let trendCode = 'on_dinh'; // 'tang' | 'on_dinh' | 'giam'
    let trendText = 'Đi ngang ổn định';
    let trendBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    let trendIcon = 'fa-solid fa-arrow-right text-amber-500';

    if (adjustedDailySlope >= 500) {
      trendCode = 'tang';
      trendText = adjustedDailySlope >= 1500 ? 'Tăng mạnh' : 'Tăng nhẹ';
      trendBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
      trendIcon = 'fa-solid fa-arrow-trend-up text-emerald-600 dark:text-emerald-400';
    } else if (adjustedDailySlope <= -500) {
      trendCode = 'giam';
      trendText = adjustedDailySlope <= -1500 ? 'Hạ nhiệt mạnh' : 'Hạ nhiệt nhẹ';
      trendBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-700';
      trendIcon = 'fa-solid fa-arrow-trend-down text-rose-600 dark:text-rose-400';
    }

    // Dự báo giá sau 3 ngày (T+3) và 5 ngày (T+5)
    // Giới hạn biên độ biến động tối đa 10% trong 3-5 ngày để tránh sai lệch ngoại lai
    const maxDelta3d = currentItem.mid * 0.10;
    let projDelta3d = Math.max(-maxDelta3d, Math.min(maxDelta3d, adjustedDailySlope * 3));
    let projDelta5d = Math.max(-maxDelta3d * 1.5, Math.min(maxDelta3d * 1.5, adjustedDailySlope * 5));

    // Làm tròn đến bội số 1.000 VNĐ
    projDelta3d = Math.round(projDelta3d / 1000) * 1000;
    projDelta5d = Math.round(projDelta5d / 1000) * 1000;

    const projectedMin3d = Math.round((currentItem.min + projDelta3d) / 1000) * 1000;
    const projectedMax3d = Math.round((currentItem.max + projDelta3d) / 1000) * 1000;
    const projectedMid3d = Math.round((currentItem.mid + projDelta3d) / 1000) * 1000;

    forecasts.push({
      ...v,
      currentMin: currentItem.min,
      currentMax: currentItem.max,
      currentMid: currentItem.mid,
      projectedMin3d,
      projectedMax3d,
      projectedMid3d,
      projectedDelta3d: projDelta3d,
      projectedSlope: adjustedDailySlope,
      trendCode,
      trendText,
      trendBadgeClass,
      trendIcon
    });
  });

  // Tổng hợp nhận định tổng quan thị trường
  let marketOverview = 'Thị trường tương đối ổn định, nguồn cung và sức mua tại các vựa đang ở trạng thái cân bằng.';
  if (tangCount > giamCount && tangCount >= 2) {
    marketOverview = 'Sức mua từ các vựa xuất khẩu sang Trung Quốc đang tăng mạnh, nguồn hàng tuyển đẹp có xu hướng giữ giá vững và nhích nhẹ.';
  } else if (giamCount > tangCount && giamCount >= 2) {
    marketOverview = 'Sản lượng thu hoạch tại một số khu vực tăng dần, thương lái siết chuẩn phân loại, giá có chiều hướng hạ nhiệt nhẹ.';
  } else if (forecasts.some(f => f.trendCode === 'tang')) {
    marketOverview = 'Xu hướng ngắn hạn ghi nhận lực cầu tốt ở các giống chủ lực (Thái, Ri6), giá dự báo duy trì đà tăng nhẹ.';
  }

  currentForecastResults = {
    region,
    latestDay: latestDayKey,
    forecasts,
    marketOverview,
    sentimentSources: sentimentSources.slice(0, 3)
  };

  return currentForecastResults;
}

/**
 * Render thẻ Dự Báo Xu Hướng Giá vào giao diện index.html
 */
function renderForecastCard() {
  const container = document.getElementById('price-forecast-container');
  if (!container) return;

  const data = calculatePriceForecast(currentRegion);
  if (!data || !data.forecasts || data.forecasts.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Đang nạp thêm dữ liệu để tính toán dự báo xu hướng...
      </div>
    `;
    return;
  }

  // Lọc lấy 2 giống chủ lực (Ri6 và Thái) lên đầu bảng dự báo
  const mainVarieties = data.forecasts.filter(f => f.keyMin.includes('ri6') || f.keyMin.includes('monthong'));
  const otherVarieties = data.forecasts.filter(f => !f.keyMin.includes('ri6') && !f.keyMin.includes('monthong'));

  let html = `
    <!-- Header Thẻ Dự Báo -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
            <i class="fa-solid fa-chart-line text-sm"></i>
          </span>
          <h2 class="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
            Dự Báo Xu Hướng Giá 3 – 5 Ngày Tới
          </h2>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            AI & Động Lượng
          </span>
        </div>
        <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
          Tính toán dựa trên hồi quy động lượng giá cắt xô 14 ngày & tổng hợp nhận định thương lái
        </p>
      </div>

      <!-- Tag thời gian dự báo -->
      <div class="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
        <i class="fa-regular fa-clock text-emerald-600 dark:text-emerald-400"></i>
        <span>Kỳ dự báo: <strong>3 – 5 ngày tới</strong></span>
      </div>
    </div>

    <!-- Tóm tắt nhận định tổng quan thị trường -->
    <div class="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-800/70 p-3.5 rounded-xl border border-emerald-100 dark:border-slate-700 mb-4 flex items-start gap-3">
      <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
        <i class="fa-solid fa-bullhorn text-xs"></i>
      </div>
      <div class="flex-1">
        <div class="text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
          Nhận định tổng quan thị trường:
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          ${data.marketOverview}
        </p>
      </div>
    </div>

    <!-- Lưới hiển thị các thẻ dự báo theo giống -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
  `;

  // Render thẻ dự báo cho từng giống chủ lực (Ri6, Thái)
  mainVarieties.forEach(item => {
    const isSinglePrice = item.currentMin === item.currentMax;
    const currentPriceText = isSinglePrice
      ? `${formatPrice(item.currentMax)} đ/kg`
      : `${formatPrice(item.currentMin)} - ${formatPrice(item.currentMax)} đ/kg`;

    const projPriceText = isSinglePrice
      ? `${formatPrice(item.projectedMax3d)} đ/kg`
      : `${formatPrice(item.projectedMin3d)} - ${formatPrice(item.projectedMax3d)} đ/kg`;

    const deltaSign = item.projectedDelta3d > 0 ? '+' : '';
    const deltaText = item.projectedDelta3d !== 0
      ? `(${deltaSign}${formatPrice(item.projectedDelta3d)} đ)`
      : '(Ổn định)';

    html += `
      <div class="bg-slate-50/70 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700/80 hover:shadow-sm transition-all">
        <div class="flex items-center justify-between mb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-md bg-${item.color}-100 dark:bg-${item.color}-950 text-${item.color}-700 dark:text-${item.color}-400 flex items-center justify-center text-xs">
              <i class="fa-solid ${item.icon}"></i>
            </span>
            <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
              ${item.name}
            </span>
          </div>

          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.trendBadgeClass}">
            <i class="${item.trendIcon} text-[10px]"></i>
            ${item.trendText}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- Cột hiện tại -->
          <div class="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
            <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Hiện tại</div>
            <div class="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
              ${currentPriceText}
            </div>
          </div>

          <!-- Cột dự báo 3-5 ngày -->
          <div class="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
            <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-between">
              <span>Dự báo 3 ngày</span>
              <span class="text-[9px] font-normal font-mono">${deltaText}</span>
            </div>
            <div class="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm">
              ${projPriceText}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  // Bảng mở rộng cho các giống còn lại (Musang King, Black Thorn, Chuồng Bò, Sáu Hữu)
  if (otherVarieties.length > 0) {
    html += `
      <div class="mt-3.5 pt-3 border-t border-slate-200/70 dark:border-slate-800">
        <details class="group cursor-pointer">
          <summary class="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center justify-between py-1">
            <span class="flex items-center gap-1.5">
              <i class="fa-solid fa-list-check text-slate-400 group-open:rotate-90 transition-transform"></i>
              Xem thêm dự báo các giống khác (Musang King, Black Thorn, Chuồng Bò, Sáu Hữu)
            </span>
            <span class="text-[11px] text-emerald-600 dark:text-emerald-400 underline font-normal">Chi tiết</span>
          </summary>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 pt-1">
    `;

    otherVarieties.forEach(item => {
      const isSinglePrice = item.currentMin === item.currentMax;
      const currentPriceText = isSinglePrice
        ? `${formatPrice(item.currentMax)} đ`
        : `${formatPrice(item.currentMin)} - ${formatPrice(item.currentMax)} đ`;

      const projPriceText = isSinglePrice
        ? `${formatPrice(item.projectedMax3d)} đ`
        : `${formatPrice(item.projectedMin3d)} - ${formatPrice(item.projectedMax3d)} đ`;

      html += `
        <div class="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div>
            <div class="font-bold text-slate-800 dark:text-slate-200 text-xs">${item.name}</div>
            <div class="text-[11px] font-mono text-slate-500 dark:text-slate-400">Hiện tại: ${currentPriceText}</div>
          </div>
          <div class="text-right">
            <span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.trendBadgeClass}">
              ${item.trendText}
            </span>
            <div class="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
              Dự báo: ${projPriceText}
            </div>
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </details>
      </div>
    `;
  }

  // Khuyến cáo an toàn / Miễn trừ trách nhiệm
  html += `
    <div class="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
      <span>* Dự báo mang tính chất tham khảo thống kê, giá thu mua thực tế tùy thuộc chất lượng trái tại vườn.</span>
      <span class="italic">Cập nhật theo dữ liệu mới nhất</span>
    </div>
  `;

  container.innerHTML = html;
}
