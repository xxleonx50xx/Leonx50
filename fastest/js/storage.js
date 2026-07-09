// ================= Persistencia local (localStorage) =================
const KEY = "fastest_state_v1";

export const DEFAULT_STATE = () => ({
  onboarded: false,
  fp: 0,               // Fastest Points (moneda)
  xp: 0,               // experiencia hacia el siguiente nivel
  level: 1,
  totalDistance: 0,    // km acumulados
  totalDrives: 0,
  bestTopSpeed: 0,
  totalStars: 0,
  drivesSinceSpin: 0,
  spinsAvailable: 0,
  streak: 0,
  lastDriveDay: null,
  equippedTheme: "aqua",
  unlocked: ["aqua"],  // ids de temas/recompensas desbloqueadas
  zonas: [],           // zonas guardadas por el usuario
  drives: [],          // historial (guardamos las últimas 30)
  dailyChallenge: null,
});

let cache = null;

export function loadState() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_STATE(), ...JSON.parse(raw) } : DEFAULT_STATE();
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
    // si el historial es enorme, recortamos y reintentamos
    state.drives = state.drives.slice(0, 15);
    localStorage.setItem(KEY, JSON.stringify(state));
  }
}

export function resetState() {
  localStorage.removeItem(KEY);
  cache = DEFAULT_STATE();
  return cache;
}
