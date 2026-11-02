// ================= Íconos de línea y logos de marcas =================
import { ICONS } from "./icons.js";
import { BRANDS } from "./brands.js";

export const icon = (name, cls = "") =>
  ICONS[name]
    ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
    : "";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const MATCHERS = BRANDS.map((b) => ({
  b,
  re: new RegExp(`(^|[^a-z0-9])(${b.kw.map((k) => norm(k).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})($|[^a-z0-9])`),
}));
const cache = new Map();
/** Busca una marca en un texto ("Oxxo casa", "Amex", "Uber Trip"…). */
export function brandFor(text) {
  const k = norm(text);
  if (!k) return null;
  if (cache.has(k)) return cache.get(k);
  const hit = MATCHERS.find((m) => m.re.test(k))?.b || null;
  cache.set(k, hit);
  return hit;
}

function light(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

/** Ficha cuadrada con el logo. */
export function logo(b, size = "") {
  if (!b) return "";
  const fg = light(b.hex) ? "#111" : "#fff";
  if (b.path) {
    return `<span class="tile logo ${size}" style="background:${b.hex}" title="${b.name}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${fg}" d="${b.path}"/></svg></span>`;
  }
  const t = b.text || b.name[0];
  const fs = t.length <= 1 ? "l" : t.length <= 2 ? "m" : t.length <= 4 ? "s" : "xs";
  return `<span class="tile logo txt ${fs} ${size}" style="background:${b.hex};color:${fg}" title="${b.name}">${t}</span>`;
}

/** Ficha con ícono de línea (tono neutro o de acento). */
export const iconTile = (name, tone = "", size = "") => `<span class="tile ${tone} ${size}">${icon(name)}</span>`;
/** Cuadrito de color con ícono blanco (como en Ajustes de iPhone). */
export const colorTile = (name, color, size = "") => `<span class="tile solid ${size}" style="--tc:${color}">${icon(name)}</span>`;
export const APPLE = { red: "#FF6B5E", orange: "#FF9F43", yellow: "#F7C948", green: "#3DD68C", mint: "#2ED1C4", teal: "#22B8CF", cyan: "#4DABF7", blue: "#5C7CFA", indigo: "#845EF7", purple: "#CC5DE8", pink: "#F06595", brown: "#D4A373", gray: "#A0A4AB" };
export const CAT_COLOR = {
  c_super: APPLE.green, c_rest: APPLE.orange, c_gas: APPLE.red, c_trans: APPLE.yellow, c_serv: APPLE.cyan, c_renta: APPLE.indigo,
  c_casa: APPLE.brown, c_subs: APPLE.pink, c_auto: APPLE.blue, c_salud: APPLE.red, c_seguro: APPLE.teal, c_gym: APPLE.orange,
  c_ropa: APPLE.purple, c_elec: APPLE.gray, c_regalo: APPLE.pink, c_viaje: APPLE.blue, c_trabajo: APPLE.indigo, c_boda: APPLE.purple, c_otros: APPLE.gray,
  i_trabajo: APPLE.green, i_bono: APPLE.yellow, i_venta: APPLE.teal, i_regalo: APPLE.pink, i_aporte: APPLE.indigo, i_reemb: APPLE.gray, i_otro: APPLE.gray,
};
export const emojiTile = (e, size = "") => `<span class="tile emoji ${size}">${e}</span>`;
