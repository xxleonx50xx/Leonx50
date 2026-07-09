// ================= Persistencia local (localStorage) =================
const KEY = "fastest_state_v1";

export const DEFAULT_STATE = () => ({
  onboarded: false,
  tutorialDone: false,
  fp: 0,               // Fastest Points (moneda)
  xp: 0,               // experiencia hacia el siguiente nivel
  level: 1,
  totalDistance: 0,    // km acumulados
  totalDrives: 0,
  totalTimeSec: 0,     // tiempo total manejando (para ranking)
  bestTopSpeed: 0,
  bestAvgSpeed: 0,
  totalStars: 0,
  drivesSinceSpin: 0,
  spinsAvailable: 0,
  streak: 0,
  lastDriveDay: null,
  equippedTheme: "rojo",
  unlocked: ["rojo"],
  // perfil del piloto
  profile: { driver: "", carName: "", brand: "", model: "", plate: "", photo: null },
  explored: [],        // celdas del mapa desbloqueadas ("gx:gy")
  medals: [],          // ids de medallas ganadas
  spotsVisited: [],    // ids de spots visitados
  spinsUsed: 0,
  lastRewardDay: null, // premio diario reclamado
  perks: {},           // skills compradas { perkId: nivel }
  sfxOn: true,
  zonas: [],
  drives: [],
  dailyChallenge: null,
});

let cache = null;

export function loadState() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = { ...DEFAULT_STATE(), ...parsed };
    cache.profile = { ...DEFAULT_STATE().profile, ...(parsed.profile || {}) };
  } catch (e) {
    cache = DEFAULT_STATE();
  }
  return cache;
}

export function saveState(state) {
  cache = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // si algo es enorme, recortamos historial/exploración y reintentamos
    state.drives = state.drives.slice(0, 12);
    state.explored = state.explored.slice(-3000);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }
}

export function resetState() {
  localStorage.removeItem(KEY);
  cache = DEFAULT_STATE();
  return cache;
}
