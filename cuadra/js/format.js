// ================= Formato: dinero, fechas, texto =================
const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MXN0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
export const money = (n) => MXN.format(round2(n));
export const money0 = (n) => MXN0.format(Math.round(Number(n) || 0));
/** Dinero con signo explícito (+/−) */
export const moneySigned = (n) => (round2(n) > 0 ? "+" : round2(n) < 0 ? "−" : "") + MXN.format(Math.abs(round2(n)));

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Convierte texto a número. Acepta "1,234.50", "$500" y operaciones simples
 * como "150+179+150" (igual que tus fórmulas de Excel).
 */
export function parseAmount(str) {
  if (typeof str === "number") return round2(str);
  let s = String(str ?? "").replace(/[$\s,]/g, "").replace(/^=/, "").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  if (!s) return NaN;
  if (!/^[0-9+\-*/().]+$/.test(s)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${s});`)();
    return Number.isFinite(v) ? round2(v) : NaN;
  } catch {
    return NaN;
  }
}

// ---------- Fechas (siempre "AAAA-MM-DD" en hora local) ----------
export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => ymd(new Date());
export const parseYmd = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
/** Suma meses respetando fin de mes (31 ene + 1 mes = 28/29 feb). */
export const addMonths = (s, n) => {
  const d = parseYmd(s);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return ymd(t);
};
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const monthKey = (s) => String(s).slice(0, 7);
export const monthStart = (key) => `${key}-01`;
export const monthEnd = (key) => addDays(addMonths(`${key}-01`, 1), -1);
export const shiftMonth = (key, n) => monthKey(addMonths(`${key}-01`, n));

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const DIAS_L = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function fmtDate(s, opts = {}) {
  if (!s) return "";
  const d = parseYmd(s);
  const t = today();
  if (!opts.plain) {
    if (s === t) return "Hoy";
    if (s === addDays(t, -1)) return "Ayer";
    if (s === addDays(t, 1)) return "Mañana";
  }
  const base = `${opts.weekday ? DIAS[d.getDay()] + " " : ""}${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() !== new Date().getFullYear() || opts.year ? `${base} ${d.getFullYear()}` : base;
}
export const fmtMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  return `${MESES_L[m - 1]} ${y}`;
};
export const fmtRange = (a, b) => `${fmtDate(a, { plain: true })} – ${fmtDate(b, { plain: true })}`;

export function relDays(s) {
  const n = daysBetween(today(), s);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
