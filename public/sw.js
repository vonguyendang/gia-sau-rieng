/**
 * public/sw.js
 * Service Worker cho ứng dụng Giá Sầu Riêng (PWA).
 * Quản lý bộ nhớ đệm (Cache), hỗ trợ cài đặt Standalone (ẩn thanh địa chỉ)
 * và tối ưu tốc độ tải trên mạng di động 3G/4G yếu tại nhà vườn.
 */

const CACHE_NAME = 'gia-sr-v2';

// Danh sách tài nguyên tĩnh cốt lõi cần nạp vào bộ đệm khi cài đặt
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './durian-logo.svg',
  './manifest.json',
  './app.js',
  './js/utils.js',
  './js/cards.js',
  './js/comparison.js',
  './js/chart.js',
  './js/sources.js',
  './js/share_image.js',
  './js/calculator.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Chỉ xử lý các yêu cầu cùng nguồn gốc (same-origin) và phương thức GET
  if (event.request.method !== 'GET') return;

  // Chiến lược Network-First đối với dữ liệu giá (data/*.json)
  // Ưu tiên lấy dữ liệu mới nhất từ mạng, nếu mất mạng thì dùng dữ liệu đã cache gần nhất
  if (url.pathname.includes('/data/') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Chiến lược Stale-While-Revalidate đối với tài nguyên giao diện (HTML, JS, CSS, Icons)
  // Trả về cache ngay lập tức để mở app siêu tốc, đồng thời tải bản mới ngầm
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Nếu offline và không có mạng, không cần báo lỗi
      });

      return cachedResponse || fetchPromise;
    })
  );
});
