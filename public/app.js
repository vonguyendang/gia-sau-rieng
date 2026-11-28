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

// Trạng thái toàn cục (được khai báo tại utils.js)
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupPwaInstallation();
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
      if (typeof initCalculator === 'function') initCalculator();
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
      if (typeof initCalculator === 'function') initCalculator();
    });
  });

  // Bộ lọc thời gian biểu đồ (1 tuần, 1 tháng, 3 tháng, 6 tháng, 1 năm, Tất cả)
  const filterBtns = document.querySelectorAll('.chart-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('bg-white', 'dark:bg-slate-700', 'text-emerald-800', 'dark:text-emerald-300', 'shadow-sm');
        b.classList.add('text-slate-600', 'dark:text-slate-400');
      });
      btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-emerald-800', 'dark:text-emerald-300', 'shadow-sm');
      btn.classList.remove('text-slate-600', 'dark:text-slate-400');

      currentRange = btn.getAttribute('data-range');
      updateChart();
    });
  });

  // Bộ chọn & điều hướng ngày dạng lưới (Grid Date Picker)
  const toggleBtn = document.getElementById('btn-date-picker-toggle');
  const popover = document.getElementById('date-picker-popover');
  const backdrop = document.getElementById('date-picker-backdrop');
  const closePopoverBtn = document.getElementById('btn-close-date-popover');
  const arrow = document.getElementById('date-picker-arrow');
  const prevBtn = document.getElementById('btn-prev-day');
  const nextBtn = document.getElementById('btn-next-day');
  const quickLatestBtn = document.getElementById('btn-quick-latest-day');

  const closeDatePopover = () => {
    if (popover) popover.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
  };

  const openDatePopover = () => {
    if (popover) popover.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
    if (arrow) arrow.classList.add('rotate-180');
  };

  if (toggleBtn && popover) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popover.classList.contains('hidden');
      if (isHidden) {
        openDatePopover();
      } else {
        closeDatePopover();
      }
    });

    if (backdrop) {
      backdrop.addEventListener('click', closeDatePopover);
    }

    if (closePopoverBtn) {
      closePopoverBtn.addEventListener('click', closeDatePopover);
    }

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !toggleBtn.contains(e.target)) {
        closeDatePopover();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
        closeDatePopover();
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

  // Nút tạo ảnh bảng giá Zalo
  const shareImgBtn = document.getElementById('btn-share-price-image');
  if (shareImgBtn) {
    shareImgBtn.addEventListener('click', () => {
      if (typeof generatePriceInfographic === 'function') {
        generatePriceInfographic();
      }
    });
  }

  // Nút thêm dòng máy tính bán vườn
  const addCalcRowBtn = document.getElementById('btn-add-calc-row');
  if (addCalcRowBtn) {
    addCalcRowBtn.addEventListener('click', () => {
      if (typeof addCalculatorRow === 'function') {
        addCalculatorRow();
      }
    });
  }

  // Nút sao chép bản tính gửi Zalo
  const copyCalcBtn = document.getElementById('btn-copy-calc-result');
  if (copyCalcBtn) {
    copyCalcBtn.addEventListener('click', () => {
      if (typeof copyCalculatorResult === 'function') {
        copyCalculatorResult();
      }
    });
  }

  // Nút nghe đọc báo giá giọng nói
  const speechBtn = document.getElementById('btn-speech-toggle');
  if (speechBtn) {
    speechBtn.addEventListener('click', () => {
      if (typeof toggleSpeechPlayback === 'function') {
        toggleSpeechPlayback();
      }
    });
  }

  // Nút đổi tốc độ đọc giọng nói
  const speedBtn = document.getElementById('btn-speech-speed');
  if (speedBtn) {
    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof cycleSpeechSpeed === 'function') {
        cycleSpeechSpeed();
      }
    });
  }

  // Khởi tạo Dark Mode
  if (typeof initDarkMode === 'function') {
    initDarkMode();
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

    try { renderHeader(); } catch (e) { console.error('Lỗi renderHeader:', e); }
    try { renderPriceCards(); } catch (e) { console.error('Lỗi renderPriceCards:', e); }
    try { renderComparisonTable(); } catch (e) { console.error('Lỗi renderComparisonTable:', e); }
    try { initOrUpdateChart(); } catch (e) { console.error('Lỗi initOrUpdateChart:', e); }
    try { populateDateSelect(); } catch (e) { console.error('Lỗi populateDateSelect:', e); }
    try { if (typeof initCalculator === 'function') initCalculator(); } catch (e) { console.error('Lỗi initCalculator:', e); }
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

/**
 * Cấu hình PWA (Service Worker và nút Cài Đặt Ứng Dụng ẩn thanh địa chỉ)
 */
function setupPwaInstallation() {
  // 1. Đăng ký Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Đăng ký Service Worker không thành công:', err);
      });
    });
  }

  const btnInstall = document.getElementById('btn-install-app');
  const installModal = document.getElementById('pwa-install-modal');
  const btnCloseModal = document.getElementById('btn-close-install-modal');
  const btnDismissModal = document.getElementById('btn-dismiss-install-modal');

  // Kiểm tra nếu ứng dụng đã chạy dưới dạng Standalone (đã cài đặt)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true || 
                       document.referrer.includes('android-app://');

  if (isStandalone) {
    // Đã ở chế độ ứng dụng không có thanh địa chỉ -> Ẩn nút cài đặt
    if (btnInstall) {
      btnInstall.classList.add('hidden');
      btnInstall.classList.remove('flex');
    }
    return;
  }

  // 2. Xử lý sự kiện beforeinstallprompt trên Chromium (Android Chrome, Edge, PC)
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.classList.remove('hidden');
      btnInstall.classList.add('flex');
    }
  });

  // 3. Xử lý cho iOS Safari (Safari không phát sự kiện beforeinstallprompt)
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  if (isIos && !isStandalone && btnInstall) {
    btnInstall.classList.remove('hidden');
    btnInstall.classList.add('flex');
  }

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        // Trình duyệt hỗ trợ hộp thoại cài đặt native (Android Chrome / PC)
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          btnInstall.classList.add('hidden');
          btnInstall.classList.remove('flex');
        }
        deferredPrompt = null;
      } else {
        // Hiển thị modal hướng dẫn cụ thể (đặc biệt cho iPhone/iPad Safari)
        if (installModal) installModal.classList.remove('hidden');
      }
    });
  }

  // Đóng modal hướng dẫn
  const closeModal = () => {
    if (installModal) installModal.classList.add('hidden');
  };
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnDismissModal) btnDismissModal.addEventListener('click', closeModal);
  if (installModal) {
    installModal.addEventListener('click', (e) => {
      if (e.target === installModal) closeModal();
    });
  }

  // Sự kiện khi người dùng đã cài đặt thành công
  window.addEventListener('appinstalled', () => {
    if (btnInstall) {
      btnInstall.classList.add('hidden');
      btnInstall.classList.remove('flex');
    }
    closeModal();
  });
}

