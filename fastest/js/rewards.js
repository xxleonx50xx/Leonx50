// ================= Sistema de recompensas "Velocidad Total" =================

// --- Niveles: XP necesaria para pasar del nivel N al N+1 ---
export function xpForLevel(level) {
  return Math.round(500 * Math.pow(level, 1.35));
}

// --- Rangos (estilo Forza), dependen del nivel ---
export const RANKS = [
  { min: 1,  name: "Novato" },
  { min: 5,  name: "Veloz" },
  { min: 10, name: "Piloto" },
  { min: 18, name: "As" },
  { min: 28, name: "Leyenda" },
  { min: 40, name: "Fastest" },
];
export function rankFor(level) {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.min) r = x;
  return r.name;
}

// --- Temas / recompensas desbloqueables (cambian el color de acento) ---
export const THEMES = [
  { id: "rojo",    name: "Rojo GT",     emoji: "🔴", accent: "#ff2e3f", accent2: "#c81422", req: { type: "start" },       reqText: "Inicial" },
  { id: "carbon",  name: "Carbón",      emoji: "⚫", accent: "#c9ced6", accent2: "#6b7280", req: { type: "level", v: 3 }, reqText: "Nivel 3" },
  { id: "nardo",   name: "Nardo",       emoji: "🩶", accent: "#b8bcc2", accent2: "#7d828b", req: { type: "level", v: 6 }, reqText: "Nivel 6" },
  { id: "cobre",   name: "Cobre",       emoji: "🟠", accent: "#ff7a3d", accent2: "#c14a12", req: { type: "level", v: 10 },reqText: "Nivel 10" },
  { id: "oro",     name: "Oro Molido",  emoji: "🟡", accent: "#f5c542", accent2: "#b8860b", req: { type: "level", v: 15 },reqText: "Nivel 15" },
  { id: "midnight",name: "Medianoche",  emoji: "🔵", accent: "#4f8bff", accent2: "#1c3faa", req: { type: "stars", v: 30 },reqText: "30 estrellas ⭐" },
  { id: "veneno",  name: "Veneno",      emoji: "🟢", accent: "#59e07a", accent2: "#1f9d4d", req: { type: "top", v: 140 }, reqText: "140 km/h de récord" },
  { id: "morado",  name: "Amatista",    emoji: "🟣", accent: "#b06bff", accent2: "#6a2fc0", req: { type: "drives", v: 25 },reqText: "25 manejos" },
];
export function themeById(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }

// ¿Se cumple el requisito de un desbloqueable dado el estado + total de estrellas?
export function meetsRequirement(theme, state, totalStars) {
  const r = theme.req;
  switch (r.type) {
    case "start":  return true;
    case "level":  return state.level >= r.v;
    case "drives": return state.totalDrives >= r.v;
    case "top":    return state.bestTopSpeed >= r.v;
    case "stars":  return totalStars >= r.v;
    default:       return false;
  }
}

// --- Ruleta: premios con niveles de suerte (rareza) ---
// weight = probabilidad relativa. Los legendarios son raros.
export const WHEEL_PRIZES = [
  { label: "+50 FP",    fp: 50,   rarity: "comun",      weight: 26, color: "#3a4a6b" },
  { label: "+150 FP",   fp: 150,  rarity: "comun",      weight: 20, color: "#2f6bff" },
  { label: "+300 FP",   fp: 300,  rarity: "raro",       weight: 14, color: "#16b0c4" },
  { label: "x2 XP",     xpBoost: 2, rarity: "raro",     weight: 12, color: "#37d67a" },
  { label: "+600 FP",   fp: 600,  rarity: "epico",      weight: 9,  color: "#c479ff" },
  { label: "+1000 FP",  fp: 1000, rarity: "epico",      weight: 6,  color: "#8a5bff" },
  { label: "GIRO EXTRA",extraSpin: true, rarity: "raro",weight: 8,  color: "#ff9d3f" },
  { label: "JACKPOT 2500", fp: 2500, rarity: "legendario", weight: 3, color: "#ffcf3f" },
  { label: "+100 FP",   fp: 100,  rarity: "comun",      weight: 2,  color: "#3a4a6b" },
];

export function pickWheelIndex() {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  // determinístico-ish sin Math.random prohibido en workflows, pero aquí (browser) sí hay random
  let r = Math.random() * total;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    r -= WHEEL_PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return WHEEL_PRIZES.length - 1;
}

// --- Desafíos diarios ---
const CHALLENGE_POOL = [
  { id: "dist5",   text: "Maneja 5 km hoy",             metric: "dist",   target: 5,   fp: 200, emoji: "🛣️" },
  { id: "stars6",  text: "Consigue 6 estrellas",         metric: "stars",  target: 6,   fp: 250, emoji: "⭐" },
  { id: "top100",  text: "Alcanza 100 km/h",             metric: "top",    target: 100, fp: 200, emoji: "💨" },
  { id: "seg8",    text: "Registra 8 tramos",            metric: "segs",   target: 8,   fp: 220, emoji: "📍" },
  { id: "combo",   text: "Logra un combo x3",            metric: "combo",  target: 3,   fp: 300, emoji: "🔗" },
];
export function rollDailyChallenge(dayKey) {
  // elige uno según el día (estable durante el día)
  const idx = Math.abs(hashStr(dayKey)) % CHALLENGE_POOL.length;
  return { ...CHALLENGE_POOL[idx], day: dayKey, progress: 0, done: false };
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

// --- Skills / Perks (se compran con FP) ---
export const PERKS = [
  { id: "fp_boost",   name: "Imán de FP",     emoji: "🧲", max: 4, per: 0.08, baseCost: 800,  desc: "+8% FP por nivel" },
  { id: "xp_boost",   name: "Turbo XP",       emoji: "⚡", max: 4, per: 0.08, baseCost: 900,  desc: "+8% XP por nivel" },
  { id: "combo_fast", name: "Combo Rápido",   emoji: "🔗", max: 3, per: 1,    baseCost: 700,  desc: "El combo sube más rápido" },
  { id: "radar",      name: "Radar",          emoji: "📡", max: 3, per: 1,    baseCost: 600,  desc: "Revela más mapa al pasar" },
];
export function perkLevel(state, id) { return (state.perks && state.perks[id]) || 0; }
export function perkCost(perk, level) { return Math.round(perk.baseCost * Math.pow(1.8, level)); }
export function perkMultiplier(state, id) {
  const perk = PERKS.find(p => p.id === id); if (!perk) return 1;
  return 1 + perkLevel(state, id) * perk.per;
}

// --- Premio diario (cofre) ---
export function dailyReward(dayKey) {
  const h = Math.abs(hashStr("chest" + dayKey));
  const fp = 150 + (h % 8) * 50;         // 150..500
  const spin = (h % 4 === 0);            // 1 de cada 4 días da giro
  return { fp, spin };
}

// --- FP y XP ganados por un manejo (aplica perks) ---
export function computeDriveRewards(drive, state) {
  const stars = drive.segments.reduce((s, x) => s + x.stars, 0);
  let fp = 0;
  fp += Math.round(drive.distanceKm * 40);
  fp += stars * 60;
  fp += Math.round(drive.maxSpeed * 2);
  fp += (drive.newRecords || 0) * 250;
  fp += (drive.maxCombo || 1) * 40;
  const fpMul = state ? perkMultiplier(state, "fp_boost") : 1;
  const xpMul = state ? perkMultiplier(state, "xp_boost") : 1;
  fp = Math.round(fp * fpMul);
  const xp = Math.round((fp * 0.6 + stars * 20) * xpMul);
  return { fp, xp, stars };
}
