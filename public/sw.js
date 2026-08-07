const CACHE = "walleton-v3";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg"];

function isCacheable(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return (
    PRECACHE.includes(url.pathname) ||
    url.pathname.startsWith("/_next/static/")
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(PRECACHE)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !isCacheable(e.request)) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
