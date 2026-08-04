// 極簡 service worker，僅用於符合 PWA 安裝資格，不做任何快取
// 所有請求都直接透傳給網路，不影響 Firestore 即時資料或既有功能
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // 不攔截、不快取，維持原本行為
});
