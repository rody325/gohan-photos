// ごはん写真 — オフラインでも開けるように、アプリの画面ファイルだけを保存しておく
// （写真は IndexedDB にあるので、ここでは扱わない）
// アプリを直したら CACHE の番号を上げる
const CACHE = 'gohan-v14';
const FILES = [
  './',
  './index.html',
  './app.css',
  './recipe-words.js',
  './voice-fix.js',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// つながるときは最新を取りに行き、2.5秒待っても来なければ保存しておいた版を使う
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    if (!cached) return net.catch(() => cache.match('./index.html'));
    return Promise.race([
      net.catch(() => cached),
      new Promise(r => setTimeout(() => r(cached), 2500)),
    ]);
  })());
});
