/**
 * public/js/sources.js
 * Quản lý Bộ điều hướng ngày dạng lưới (Date Picker Popover) và hiển thị Thẻ bản tin YouTube.
 */

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
            
            let sourceCount = 0;
            if (historyData?.days?.[d]?.source_count !== undefined) {
              sourceCount = historyData.days[d].source_count;
            } else if (sourcesCache[d] && Array.isArray(sourcesCache[d])) {
              sourceCount = sourcesCache[d].length;
            } else if (historyData?.days?.[d]?.sources && Array.isArray(historyData.days[d].sources)) {
              sourceCount = historyData.days[d].sources.length;
            }

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
                  <span class="${countClass}">${sourceCount} tin</span>
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
    prevBtn.disabled = (idx >= daysKeys.length - 1);
  }
  if (nextBtn) {
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
    const backdrop = document.getElementById('date-picker-backdrop');
    const arrow = document.getElementById('date-picker-arrow');
    if (popover) popover.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
  }

  // Render danh sách nguồn tin của ngày đã chọn (tải động)
  renderSources(dayKey);

  // Cập nhật giá máy tính theo ngày đang xem nếu có
  if (typeof initCalculator === 'function') initCalculator();
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
