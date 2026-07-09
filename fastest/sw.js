// ================= Service Worker · Fastest =================
const CACHE = "fastest-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/tracker.js",
  "./js/analysis.js",
  "./js/map.js",
  "./js/rewards.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // mapas y fuentes: red primero (necesitan datos frescos)
  if (url.host.includes("basemaps") || url.host.includes("tile") || url.host.includes("fonts")) return;
  // app shell: cache primero, con respaldo de red
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (e.request.method === "GET" && res.ok && url.origin === location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
