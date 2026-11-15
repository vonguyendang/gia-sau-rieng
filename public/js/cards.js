/**
 * public/js/cards.js
 * Quản lý hiển thị Header ngày tháng và 6 thẻ giá sầu riêng cắt xô tại vườn.
 */

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
