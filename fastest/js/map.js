// ================= Mapa (Leaflet + OpenStreetMap) =================
let map = null;
let liveLine = null;
let meMarker = null;
let segLayers = [];

export function initMap() {
  if (map || typeof L === "undefined") return map;
  map = L.map("map", { zoomControl: false, attributionControl: true, dragging: true }).setView([19.4326, -99.1332], 15);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap · CARTO",
    maxZoom: 20,
  }).addTo(map);
  return map;
}

export function centerOn(lat, lng, zoom) {
  if (!map) return;
  map.setView([lat, lng], zoom || map.getZoom(), { animate: true });
}

export function updateMe(lat, lng, follow = true) {
  if (!map) return;
  if (!meMarker) {
    const icon = L.divIcon({ className: "me-dot", html: '<div class="me-core"></div><div class="me-ring"></div>', iconSize: [26, 26] });
    meMarker = L.marker([lat, lng], { icon }).addTo(map);
  } else {
    meMarker.setLatLng([lat, lng]);
  }
  if (follow) map.panTo([lat, lng], { animate: true, duration: .5 });
}

export function resetLive() {
  if (liveLine) { map.removeLayer(liveLine); liveLine = null; }
  clearSegments();
}

export function extendLive(latlng) {
  if (!map) return;
  if (!liveLine) {
    liveLine = L.polyline([latlng], { color: getAccent(), weight: 5, opacity: .9 }).addTo(map);
  } else {
    liveLine.addLatLng(latlng);
  }
}

function speedColor(kmh) {
  // azul (lento) -> verde -> amarillo -> rojo (rápido)
  if (kmh < 20) return "#3d7bff";
  if (kmh < 45) return "#16f2c4";
  if (kmh < 70) return "#c6ff33";
  if (kmh < 100) return "#ffcf3f";
  return "#ff4d6d";
}

export function clearSegments() {
  segLayers.forEach(l => map && map.removeLayer(l));
  segLayers = [];
}

// dibuja los tramos coloreados por velocidad y ajusta el encuadre
export function drawSegments(segments) {
  if (!map) return;
  clearSegments();
  const all = [];
  segments.forEach(seg => {
    const line = L.polyline(seg.coords, { color: speedColor(seg.avgSpeed), weight: 6, opacity: .95 }).addTo(map);
    segLayers.push(line);
    seg.coords.forEach(c => all.push(c));
  });
  if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.25), { animate: true });
}

function getAccent() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#16f2c4";
}

export function refreshLiveColor() {
  if (liveLine) liveLine.setStyle({ color: getAccent() });
}
