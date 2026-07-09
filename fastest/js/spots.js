// ================= Spots fotográficos por ciudad =================
// Puntos de interés con vistas cool. Al acercarte (~150 m) haces "check-in"
// y puedes subir una foto para ganar FP.
// Coordenadas aproximadas — se pueden afinar con precisión más adelante.

export const CITIES = {
  culiacan: {
    name: "Culiacán",
    center: [24.809, -107.394],
    spots: [
      { id: "lomita",    name: "La Lomita",            emoji: "⛪", fp: 400, lat: 24.8146, lng: -107.3826, tip: "Mirador con vista de toda la ciudad, ideal de noche." },
      { id: "catedral",  name: "Catedral de Culiacán", emoji: "🏛️", fp: 300, lat: 24.7994, lng: -107.3939, tip: "Centro histórico, fachada neoclásica." },
      { id: "letras",    name: "Letras de Culiacán",   emoji: "🔤", fp: 200, lat: 24.7990, lng: -107.3946, tip: "La foto clásica en las letras de colores." },
      { id: "riberas",   name: "Parque Las Riberas",   emoji: "🌊", fp: 250, lat: 24.8060, lng: -107.3770, tip: "Malecón junto al río Tamazula." },
      { id: "botanico",  name: "Jardín Botánico",      emoji: "🌳", fp: 300, lat: 24.8258, lng: -107.3846, tip: "Arte y naturaleza, muy fotogénico." },
      { id: "tresrios",  name: "Tres Ríos",            emoji: "🌉", fp: 250, lat: 24.8030, lng: -107.3882, tip: "Zona nueva junto a la confluencia de los ríos." },
      { id: "obregon",   name: "Plazuela Obregón",     emoji: "🕰️", fp: 200, lat: 24.7999, lng: -107.3928, tip: "El corazón del centro viejo." },
    ],
  },
};

export function getCity(id) { return CITIES[id] || CITIES.culiacan; }

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000, dLat = (bLat - aLat) * Math.PI / 180, dLng = (bLng - aLng) * Math.PI / 180;
  const la1 = aLat * Math.PI / 180, la2 = bLat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// spot más cercano dentro del radio (metros), o null
export function nearbySpot(lat, lng, city, radius = 160) {
  let best = null, bestD = radius;
  for (const s of city.spots) {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}
