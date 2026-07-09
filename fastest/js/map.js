// ================= Mapa (Leaflet + niebla + carro R34) =================
import { createFogLayer, cellKey } from "./fog.js";

let map = null, liveLine = null, carMarker = null, fog = null, segLayers = [];

// Silueta lateral estilo Nissan Skyline R34 (blanca).
const R34_SVG = `
<svg width="52" height="24" viewBox="0 0 120 54" xmlns="http://www.w3.org/2000/svg">
  <g class="r34">
    <path d="M6 40 C4 34 8 31 14 30 L26 29 C31 23 39 18 52 17 L74 17 C84 17 92 20 98 26 L110 29 C116 30 118 34 116 40 L112 41 C112 46 108 49 103 49 C98 49 94 46 94 41 L40 41 C40 46 36 49 31 49 C26 49 22 46 22 41 Z"
      fill="#f4f6fa" stroke="#0b0b0d" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M34 28 C39 23 45 20 53 20 L62 20 L62 28 Z" fill="#12151b"/>
    <path d="M66 20 L73 20 C80 20 86 22 90 27 L66 28 Z" fill="#12151b"/>
    <rect x="99" y="22" width="10" height="5" rx="2" fill="#12151b"/>
    <path d="M96 18 L118 16 L118 20 L98 22 Z" fill="#e11d2a"/>
    <circle cx="31" cy="41" r="8.5" fill="#101216" stroke="#c9ced6" stroke-width="2.2"/>
    <circle cx="103" cy="41" r="8.5" fill="#101216" stroke="#c9ced6" stroke-width="2.2"/>
    <circle cx="31" cy="41" r="2.4" fill="#c9ced6"/>
    <circle cx="103" cy="41" r="2.4" fill="#c9ced6"/>
    <rect x="6" y="33" width="4" height="4" rx="1" fill="#ffdb6a"/>
  </g>
</svg>`;

export function initMap() {
  if (map || typeof L === "undefined") return map;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([24.809, -107.394], 15);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap · CARTO", maxZoom: 20,
  }).addTo(map);
  return map;
}

export function getMap() { return map; }
export function centerOn(lat, lng, zoom) { if (map) map.setView([lat, lng], zoom || map.getZoom(), { animate: true }); }

// ---- niebla ----
export function initFog(keys) {
  if (!map) return;
  if (fog) map.removeLayer(fog);
  fog = createFogLayer(keys);
  fog.addTo(map);
}
export function revealCell(lat, lng) { if (fog) fog.addKey(cellKey(lat, lng)); }
export function revealCellKeys(keys) { if (fog) fog.addKeys(keys); }
export function fogLive(lat, lng) { if (fog) fog.setLive(lat === null ? null : [lat, lng]); }

// ---- carro ----
export function setCar(lat, lng, heading, follow = true) {
  if (!map) return;
  if (!carMarker) {
    const icon = L.divIcon({ className: "car-marker", html: R34_SVG, iconSize: [52, 24], iconAnchor: [26, 12] });
    carMarker = L.marker([lat, lng], { icon, interactive: false, keyboard: false }).addTo(map);
  } else {
    carMarker.setLatLng([lat, lng]);
  }
  // side-view: se voltea según viaje (este/oeste) para no quedar de cabeza
  const flip = heading > 180 ? -1 : 1;
  const el = carMarker.getElement();
  if (el) { const svg = el.querySelector("svg"); if (svg) svg.style.transform = `scaleX(${flip})`; }
  if (follow) map.panTo([lat, lng], { animate: true, duration: .4 });
}
export function removeCar() { if (carMarker && map) { map.removeLayer(carMarker); carMarker = null; } }

// ---- traza en vivo ----
export function resetLive() {
  if (liveLine) { map.removeLayer(liveLine); liveLine = null; }
  clearSegments();
}
export function extendLive(latlng) {
  if (!map) return;
  if (!liveLine) liveLine = L.polyline([latlng], { color: accent(), weight: 5, opacity: .95 }).addTo(map);
  else liveLine.addLatLng(latlng);
}

function speedColor(kmh) {
  if (kmh < 20) return "#5a6270";
  if (kmh < 45) return "#4f8bff";
  if (kmh < 70) return "#59e07a";
  if (kmh < 100) return "#f5c542";
  return "#ff2e3f";
}
export function clearSegments() { segLayers.forEach(l => map && map.removeLayer(l)); segLayers = []; }
export function drawSegments(segments) {
  if (!map) return;
  clearSegments();
  const all = [];
  segments.forEach(seg => {
    const line = L.polyline(seg.coords, { color: speedColor(seg.avgSpeed), weight: 6, opacity: .95 }).addTo(map);
    segLayers.push(line);
    seg.coords.forEach(c => all.push(c));
  });
  if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.3), { animate: true, maxZoom: 16 });
}

function accent() { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff2e3f"; }
export function refreshLiveColor() { if (liveLine) liveLine.setStyle({ color: accent() }); }
