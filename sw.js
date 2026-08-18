// ★ 改動 index.html 後要把版號 +1，舊快取才會被清掉
const CACHE_NAME = 'hdex-kol-v3';
const STATIC_ASSETS = [
  '/hdex-dashboard/',
  '/hdex-dashboard/index.html',
  '/hdex-dashboard/manifest.json',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// Install - cache static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {
        // Ignore cache failures for external resources
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
// - Apps Script API + 賽事 Google Sheet: network only（一定要拿到最新資料）
// - index.html / 導覽請求: network first，離線時才回快取
//   （原本是 cache first，改版後使用者會一直看到舊版直到快取過期）
// - Google Fonts / CDN / 其他靜態檔: cache first
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // 資料來源一律走網路，也不要寫進快取（否則「重新整理賽事」會拿到舊資料）
  if (url.indexOf('script.google.com') !== -1 || url.indexOf('docs.google.com') !== -1) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // 頁面本身：先抓網路，失敗才用快取
  var isPage = e.request.mode === 'navigate' || url.indexOf('index.html') !== -1;
  if (isPage) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/hdex-dashboard/index.html');
        });
      })
    );
    return;
  }

  // 其他靜態資源：快取優先
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (e.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    })
  );
});
