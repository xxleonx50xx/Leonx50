// ================= Service Worker · Fastest =================
// Estrategia: "red primero" para el código de la app (HTML/JS/CSS) para que
// SIEMPRE se vea la versión más reciente; respaldo desde caché si no hay red.
const VERSION = "v3";
const CACHE = "fastest-" + VERSION;
const ASSETS = [
  "./", "./index.html", "./css/styles.css",
  "./js/app.js", "./js/storage.js", "./js/tracker.js", "./js/analysis.js",
  "./js/map.js", "./js/rewards.js", "./js/fog.js", "./js/tutorial.js",
  "./js/spots.js", "./js/achievements.js", "./js/leaderboard.js",
  "./js/sfx.js", "./js/circuits.js", "./js/icons.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // mapas y fuentes: siempre red (no cachear)
  if (url.host.includes("basemaps") || url.host.includes("tile") || url.host.includes("fonts") || url.host.includes("unpkg")) return;

  // código propio: red primero, con respaldo de caché
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
  }
});
