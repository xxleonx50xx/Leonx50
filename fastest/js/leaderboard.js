// ================= Ranking (local + rivales simulados) =================
// Nota: para un ranking realmente online entre amigos hace falta un backend.
// Por ahora comparamos contra rivales locales para que la mecánica se sienta viva.

const RIVALS = [
  { name: "El Culichi", car: "Nissan Silvia S15", emoji: "🏎️", top: 168, time: 41200, dist: 890, avg: 62 },
  { name: "Chuy Turbo", car: "Toyota Supra MK4", emoji: "🐉", top: 182, time: 30500, dist: 640, avg: 71 },
  { name: "La Sombra", car: "Mazda RX-7 FD", emoji: "👤", top: 155, time: 52000, dist: 1120, avg: 55 },
  { name: "Ken_R34", car: "Nissan Skyline R34", emoji: "⚪", top: 176, time: 26800, dist: 510, avg: 74 },
  { name: "Vato Veloz", car: "Honda Civic Type R", emoji: "🔧", top: 149, time: 38000, dist: 720, avg: 58 },
  { name: "Doña Racing", car: "VW Golf GTI", emoji: "🌸", top: 138, time: 61000, dist: 1340, avg: 49 },
  { name: "El Puma", car: "Subaru WRX STI", emoji: "🐆", top: 161, time: 33400, dist: 690, avg: 64 },
  { name: "NoLift", car: "Mitsubishi Evo IX", emoji: "🚀", top: 190, time: 22000, dist: 430, avg: 78 },
  { name: "Barrio 80", car: "Ford Mustang GT", emoji: "🐎", top: 172, time: 29000, dist: 600, avg: 66 },
];

export const CATEGORIES = [
  { id: "top",  label: "Top Speed",    unit: "km/h", field: "top",  fmt: (v) => Math.round(v) },
  { id: "time", label: "Tiempo",        unit: "",     field: "time", fmt: (v) => fmtHrs(v) },
  { id: "dist", label: "Distancia",     unit: "km",   field: "dist", fmt: (v) => Math.round(v) },
  { id: "avg",  label: "Prom. veloc.",  unit: "km/h", field: "avg",  fmt: (v) => Math.round(v) },
];

function fmtHrs(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function buildBoard(catId, player) {
  const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
  const me = {
    name: player.profile?.driver || "Tú",
    car: [player.profile?.brand, player.profile?.model].filter(Boolean).join(" ") || player.profile?.carName || "Tu carro",
    emoji: "🫵", photo: player.profile?.photo || null, isPlayer: true,
    top: player.bestTopSpeed, time: player.totalTimeSec, dist: player.totalDistance, avg: player.bestAvgSpeed,
  };
  const rows = [...RIVALS, me]
    .map(r => ({ ...r, value: r[cat.field] || 0 }))
    .sort((a, b) => b.value - a.value);
  return { cat, rows };
}
