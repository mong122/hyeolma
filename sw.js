// 혈마 키우기 — 인터넷 없이도 켜지게 파일을 폰에 담아 둠
// 새 판을 올리면 CACHE 이름의 숫자를 올림
const CACHE = 'hyeolma-0.1.3';
const FILES = ['./', 'index.html', 'style.css', 'js/data.js', 'js/core.js', 'js/ui.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 인터넷 먼저 (새 판 바로 보임), 안 되면 담아 둔 것
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
