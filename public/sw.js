// Offline cache: network-first for the page and memes.json (so updates show up), cache-first for everything else
const CACHE = 'leguna-v2'; // bump whenever files in public/ change (audio clips, engine loop) so phones fetch them again

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fresh = req.mode === 'navigate' || url.pathname.endsWith('memes.json');

  const fromNetwork = () => fetch(req).then((res) => {
    if (res.ok && (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });

  e.respondWith(
    fresh
      ? fromNetwork().catch(() => caches.match(req))
      : caches.match(req).then((hit) => hit || fromNetwork())
  );
});
