/* 基準点マップ Service Worker（完全オフライン対応）
   このファイルは HTML と同じフォルダに置いてください（例：bb117010.github.io のリポジトリ直下）。
   HTML 側が自動でこの sw.js を見つけて登録します。 */

const CACHE = 'kijunten-app-v1';       // アプリ本体（HTML等）用
const TILE_CACHE = 'kijunten-tiles-v1'; // 地図タイル用

// インストール時：すぐ有効化
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// 有効化時：古いキャッシュを掃除して即制御開始
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k !== TILE_CACHE)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = req.url;

  // GET 以外は素通し
  if (req.method !== 'GET') return;

  // 地図タイル（国土地理院・OSM 等）：キャッシュ優先＋裏で更新（オフラインでも再表示可）
  if (/cyberjapandata|gsi\.go\.jp|tile\.openstreetmap|basemaps|tile\./.test(url)) {
    e.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // アプリ本体（ページ遷移）：ネット優先、失敗時はキャッシュから（＝オフラインでも起動）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then((h) => h || caches.match('./') || caches.match('index.html'))
      )
    );
    return;
  }

  // 同一オリジンのその他ファイル（CSS/JS/画像など）：キャッシュ優先＋裏で更新
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // それ以外（外部CDN等）：ネット優先、失敗時キャッシュ
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
