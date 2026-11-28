/**
 * public/js/calculator.js
 * Máy tính tiền bán sầu riêng cắt vườn tức thì (Quick Harvest Calculator).
 * Chạy 100% bằng JavaScript thuần trên trình duyệt người dùng (0đ, 0 server, bảo trì vĩnh viễn).
 */

let calcRows = [
  { varietyKey: 'monthong_a', price: 0, weight: 3000 },
  { varietyKey: 'ri6_a', price: 0, weight: 1500 }
];

const VARIETY_LIST = [
  { key: 'monthong_a', name: 'Thái Monthong (Xô 8:2 - Vườn đẹp)', defaultPriceKey: 'monthong_a' },
  { key: 'monthong_b', name: 'Thái Monthong (Xô 7:3 - Vườn trung bình)', defaultPriceKey: 'monthong_b' },
  { key: 'ri6_a', name: 'Sầu riêng Ri6 (Xô 8:2 - Vườn đẹp)', defaultPriceKey: 'ri6_a' },
  { key: 'ri6_b', name: 'Sầu riêng Ri6 (Xô 7:3 - Vườn trung bình)', defaultPriceKey: 'ri6_b' },
  { key: 'musang_king', name: 'Sầu riêng Musang King', defaultPriceKey: 'musang_king' },
  { key: 'black_thorn', name: 'Sầu riêng Black Thorn (Gai Đen)', defaultPriceKey: 'black_thorn' },
  { key: 'chuong_bo', name: 'Sầu riêng Chuồng Bò', defaultPriceKey: 'chuong_bo' },
  { key: 'sau_huu', name: 'Sầu riêng Sáu Hữu', defaultPriceKey: 'sau_huu' }
];

// Khởi tạo hoặc cập nhật máy tính khi nạp dữ liệu xong
function initCalculator() {
  const container = document.getElementById('calculator-rows-container');
  if (!container) return;

  // Lấy bảng giá hôm nay
  const currentPrices = getCurrentDayPrices();

  // Khởi tạo giá ban đầu cho các dòng nếu chưa có
  calcRows.forEach(row => {
    if (!row.price || row.price === 0) {
      row.price = currentPrices[row.varietyKey] || 0;
    }
  });

  renderCalculatorRows();
  updateCalculatorTotal();
}

function getCurrentDayPrices() {
  if (!historyData || !historyData.days) return {};
  const daysKeys = historyData.available_days || Object.keys(historyData.days).sort().reverse();
  const activeDay = currentSelectedDay || daysKeys[0];
  const dayData = historyData.days[activeDay];
  if (!dayData) return {};

  if (currentRegion !== 'all' && dayData.by_region && dayData.by_region[currentRegion]) {
    return dayData.by_region[currentRegion];
  }
  return dayData.daily_average || {};
}

function renderCalculatorRows() {
  const container = document.getElementById('calculator-rows-container');
  if (!container) return;

  const currentPrices = getCurrentDayPrices();

  let html = '';
  calcRows.forEach((row, index) => {
    const lineTotal = (row.price || 0) * (row.weight || 0);

    const optionsHtml = VARIETY_LIST.map(v => {
      const isSel = v.key === row.varietyKey ? 'selected' : '';
      return `<option value="${v.key}" ${isSel}>${v.name}</option>`;
    }).join('');

    html += `
      <div class="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-3 sm:p-3.5 space-y-2.5 relative transition-all" data-calc-index="${index}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] font-extrabold flex items-center justify-center">${index + 1}</span>
            Giống sầu riêng:
          </span>
          ${calcRows.length > 1 ? `
            <button type="button" class="btn-remove-calc-row text-slate-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 text-xs px-2 py-0.5 rounded transition-colors cursor-pointer" data-index="${index}" title="Xóa dòng này">
              <i class="fa-solid fa-trash-can"></i> Xóa
            </button>
          ` : ''}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <!-- Chọn giống -->
          <div class="sm:col-span-5">
            <select class="calc-variety-select w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer" data-index="${index}">
              ${optionsHtml}
            </select>
          </div>

          <!-- Đơn giá (đ/kg) -->
          <div class="sm:col-span-3">
            <div class="relative">
              <input type="number" step="500" min="0" value="${row.price}" class="calc-price-input w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-9 py-1.5 text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" data-index="${index}" placeholder="Giá bán">
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">đ/kg</span>
            </div>
          </div>

          <!-- Số lượng (kg) -->
          <div class="sm:col-span-4">
            <div class="relative">
              <input type="number" step="50" min="0" value="${row.weight}" class="calc-weight-input w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" data-index="${index}" placeholder="Số lượng kg">
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-semibold">kg</span>
            </div>
          </div>
        </div>

        <!-- Thành tiền dòng -->
        <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700 text-xs">
          <span class="text-slate-500 dark:text-slate-400">Thành tiền (${row.weight >= 1000 ? (row.weight / 1000).toFixed(2) + ' tấn' : row.weight + ' kg'}):</span>
          <span class="font-extrabold text-emerald-800 dark:text-emerald-400 text-sm font-mono">${formatNumber(lineTotal)} VNĐ</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  bindCalculatorEvents();
}

function bindCalculatorEvents() {
  // Thay đổi giống
  document.querySelectorAll('.calc-variety-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const vKey = e.target.value;
      calcRows[idx].varietyKey = vKey;
      const currentPrices = getCurrentDayPrices();
      if (currentPrices[vKey]) {
        calcRows[idx].price = currentPrices[vKey];
      }
      renderCalculatorRows();
      updateCalculatorTotal();
    });
  });

  // Thay đổi giá
  document.querySelectorAll('.calc-price-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      calcRows[idx].price = parseFloat(e.target.value) || 0;
      updateCalculatorTotal();
    });
  });

  // Thay đổi số kg
  document.querySelectorAll('.calc-weight-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      calcRows[idx].weight = parseFloat(e.target.value) || 0;
      updateCalculatorTotal();
    });
  });

  // Xóa dòng
  document.querySelectorAll('.btn-remove-calc-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (calcRows.length > 1) {
        calcRows.splice(idx, 1);
        renderCalculatorRows();
        updateCalculatorTotal();
      }
    });
  });
}

function updateCalculatorTotal() {
  let totalWeight = 0;
  let totalMoney = 0;

  calcRows.forEach((row, index) => {
    const lineMoney = (row.price || 0) * (row.weight || 0);
    totalWeight += (row.weight || 0);
    totalMoney += lineMoney;

    // Cập nhật text thành tiền của từng dòng (nếu người dùng đang gõ input)
    const cardEl = document.querySelector(`[data-calc-index="${index}"]`);
    if (cardEl) {
      const totalSpan = cardEl.querySelector('.font-mono');
      if (totalSpan) totalSpan.textContent = `${formatNumber(lineMoney)} VNĐ`;
    }
  });

  const totalMoneyEl = document.getElementById('calc-total-money');
  const totalWeightEl = document.getElementById('calc-total-weight');
  const wordsMoneyEl = document.getElementById('calc-words-money');

  if (totalMoneyEl) totalMoneyEl.textContent = `${formatNumber(totalMoney)} VNĐ`;
  if (totalWeightEl) {
    const tons = (totalWeight / 1000).toFixed(2);
    totalWeightEl.textContent = `${formatNumber(totalWeight)} kg (${tons} tấn)`;
  }
  if (wordsMoneyEl) {
    wordsMoneyEl.textContent = totalMoney > 0 ? `(${numberToVietnameseWords(totalMoney)})` : '';
  }
}

// Thêm dòng mới
function addCalculatorRow() {
  const currentPrices = getCurrentDayPrices();
  calcRows.push({
    varietyKey: 'ri6_b',
    price: currentPrices['ri6_b'] || 50000,
    weight: 1000
  });
  renderCalculatorRows();
  updateCalculatorTotal();
}

// Sao chép kết quả tính tiền gửi Zalo
function copyCalculatorResult() {
  const daysKeys = historyData.available_days || Object.keys(historyData.days).sort().reverse();
  const activeDay = currentSelectedDay || daysKeys[0];
  const dateFormatted = formatDateStr(activeDay, true);

  let text = `📋 BẢNG TÍNH TIỀN SẦU RIÊNG CẮT VƯỜN (${dateFormatted})\n`;
  let totalWeight = 0;
  let totalMoney = 0;

  calcRows.forEach((row, i) => {
    const vObj = VARIETY_LIST.find(v => v.key === row.varietyKey);
    const vName = vObj ? vObj.name : row.varietyKey;
    const lineTotal = (row.price || 0) * (row.weight || 0);
    totalWeight += (row.weight || 0);
    totalMoney += lineTotal;
    text += `${i + 1}. ${vName}:\n   ${formatNumber(row.weight)} kg x ${formatNumber(row.price)} đ = ${formatNumber(lineTotal)} đ\n`;
  });

  const tons = (totalWeight / 1000).toFixed(2);
  text += `------------------------------------\n`;
  text += `👉 TỔNG SẢN LƯỢNG: ${formatNumber(totalWeight)} kg (~${tons} tấn)\n`;
  text += `💰 TỔNG THU VỀ: ${formatNumber(totalMoney)} VNĐ\n`;
  text += `(${numberToVietnameseWords(totalMoney)})\n\n`;
  text += `* Lưu ý: Bảng tính mang tính tham khảo, giá thực tế phụ thuộc tỷ lệ phân loại và thỏa thuận tại vườn.\n`;
  text += `Tra cứu giá tại: https://vonguyendang.github.io/gia-sau-rieng/`;

  navigator.clipboard.writeText(text).then(() => {
    const statusEl = document.getElementById('calc-copy-status');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
  });
}

// Hàm đọc số tiền thành chữ tiếng Việt chuẩn xác
function numberToVietnameseWords(number) {
  if (!number || number <= 0) return '';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readThreeDigits(n, isLastGroup) {
    let h = Math.floor(n / 100);
    let t = Math.floor((n % 100) / 10);
    let u = n % 10;
    let res = '';

    if (h > 0 || !isLastGroup) {
      res += digits[h] + ' trăm ';
    }
    if (t > 1) {
      res += digits[t] + ' mươi ';
      if (u === 1) res += 'mốt';
      else if (u === 5) res += 'lăm';
      else if (u > 0) res += digits[u];
    } else if (t === 1) {
      res += 'mười ';
      if (u === 5) res += 'lăm';
      else if (u > 0) res += digits[u];
    } else if (t === 0 && u > 0) {
      if (h > 0 || !isLastGroup) res += 'lẻ ';
      res += digits[u];
    }
    return res.trim();
  }

  let strNum = Math.floor(number).toString();
  let groups = [];
  while (strNum.length > 0) {
    groups.unshift(parseInt(strNum.slice(-3), 10));
    strNum = strNum.slice(0, -3);
  }

  let words = [];
  const totalGroups = groups.length;
  groups.forEach((g, idx) => {
    if (g > 0) {
      const isLast = idx === totalGroups - 1;
      const groupText = readThreeDigits(g, idx === 0);
      const unit = units[totalGroups - 1 - idx];
      words.push(groupText + (unit ? ' ' + unit : ''));
    }
  });

  let result = words.join(' ').replace(/\s+/g, ' ').trim();
  if (!result) return '';
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}
