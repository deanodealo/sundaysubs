// Sunday Subs service worker.
// Serves the app from cache instantly (works with no signal) and quietly
// fetches the latest version in the background, so a new deploy shows up
// on the next launch. Bump CACHE only if you rename or remove shell files.
const CACHE = 'sunday-subs-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: stale-while-revalidate
  if (url.origin === location.origin) {
    const key = req.mode === 'navigate' ? new Request('./index.html') : req;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req).then(res => {
        if (res.ok && !res.redirected) cache.put(key, res.clone());
        return res;
      });
      if (cached) {
        e.waitUntil(network.catch(() => {}));
        return cached;
      }
      try { return await network; }
      catch (err) { return new Response('Offline and not cached yet. Open the app once with signal.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
    })());
    return;
  }

  // Google Fonts: cache-first so the typeface works offline too
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (err) { return Response.error(); }
    })());
  }
});
