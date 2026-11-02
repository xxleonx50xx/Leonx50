// ================= Service Worker · Cuadra =================
// "Red primero" para el código (siempre la versión más nueva) y respaldo
// desde caché para que la app abra sin internet.
const VERSION = "v11";
const CACHE = "cuadra-" + VERSION;
const ASSETS = [
  "./", "./index.html", "./css/styles.css", "./manifest.webmanifest",
  "./js/app.js", "./js/store.js", "./js/calc.js", "./js/format.js", "./js/ui.js", "./js/views.js", "./js/forms.js",
  "./js/quick.js", "./js/logos.js", "./js/icons.js", "./js/brands.js", "./js/gestures.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cuadra-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fuentes, etc.: red directa
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); return res; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
