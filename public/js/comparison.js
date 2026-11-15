/**
 * public/js/comparison.js
 * Quản lý logic tính toán và hiển thị Bảng so sánh biến động giá (T-1, T-7, T-30, YoY).
 */

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
