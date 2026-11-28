/**
 * public/js/darkmode.js
 * Quản lý chế độ giao diện Sáng / Tối (Dark Mode) cho nhà vườn và thương lái đi đêm.
 * Chạy 100% bằng JavaScript và localStorage trên trình duyệt (0đ, 0 server).
 */

function initDarkMode() {
  const isDark = localStorage.getItem('theme') === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

  applyTheme(isDark);

  const toggleBtn = document.getElementById('btn-dark-mode-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentIsDark = document.documentElement.classList.contains('dark');
      applyTheme(!currentIsDark);
      localStorage.setItem('theme', !currentIsDark ? 'dark' : 'light');
    });
  }
}

function applyTheme(isDark) {
  const html = document.documentElement;
  const icon = document.getElementById('dark-mode-icon');
  const title = document.getElementById('btn-dark-mode-toggle');

  if (isDark) {
    html.classList.add('dark');
    if (icon) {
      icon.className = 'fa-solid fa-sun text-sm sm:text-base text-amber-300';
    }
    if (title) title.title = 'Chuyển sang giao diện Sáng';
  } else {
    html.classList.remove('dark');
    if (icon) {
      icon.className = 'fa-solid fa-moon text-sm sm:text-base text-emerald-200';
    }
    if (title) title.title = 'Chuyển sang giao diện Tối (Dark Mode)';
  }

  // Cập nhật lại màu biểu đồ Chart.js nếu có
  if (typeof initOrUpdateChart === 'function' && window.priceChartInstance) {
    setTimeout(() => initOrUpdateChart(), 50);
  }
}

// Khởi tạo ngay lập tức để tránh chớp màn hình trắng khi tải trang
(function() {
  try {
    const isDark = localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
