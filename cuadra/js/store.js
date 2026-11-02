// ================= Estado y persistencia (localStorage) =================
// Todo vive en tu teléfono. Haz respaldos (Más → Respaldo) con frecuencia.
import { today } from "./format.js";

const KEY = "cuadra_state_v1";
export const SCHEMA = 1;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const ACCOUNT_TYPES = {
  debit: { label: "Débito", plural: "Débito", icon: "💳", ico: "landmark" },
  cash: { label: "Efectivo", plural: "Efectivo", icon: "💵", ico: "banknote" },
  fund: { label: "Fondo común", plural: "Fondo común", icon: "🏠", ico: "house" },
  savings: { label: "Ahorro", plural: "Ahorro / inversión", icon: "🌱", ico: "piggy-bank" },
  credit: { label: "Crédito", plural: "Tarjetas de crédito", icon: "💳", ico: "credit-card" },
};

// ícono de línea para las categorías predeterminadas
export const CAT_ICO = {
  c_super: "shopping-cart", c_rest: "utensils", c_gas: "fuel", c_trans: "car-taxi-front", c_serv: "lightbulb",
  c_renta: "house", c_casa: "sofa", c_subs: "tv", c_auto: "car", c_salud: "stethoscope", c_seguro: "shield",
  c_gym: "dumbbell", c_ropa: "shirt", c_elec: "smartphone", c_regalo: "gift", c_viaje: "plane", c_trabajo: "briefcase",
  c_boda: "gem", c_otros: "package", c_agua: "droplet", c_internet: "wifi",
  i_trabajo: "briefcase", i_bono: "star", i_venta: "tag", i_regalo: "gift", i_aporte: "house-plus", i_reemb: "undo-2", i_otro: "circle-plus",
};

export const DEFAULT_CATEGORIES = () => [
  // gastos
  { id: "c_super", kind: "expense", name: "Súper", icon: "🛒", household: true },
  { id: "c_rest", kind: "expense", name: "Restaurantes", icon: "🍽️" },
  { id: "c_gas", kind: "expense", name: "Gasolina", icon: "⛽", household: true },
  { id: "c_trans", kind: "expense", name: "Transporte", icon: "🚕" },
  { id: "c_serv", kind: "expense", name: "Servicios", icon: "💡", household: true },
  { id: "c_renta", kind: "expense", name: "Renta", icon: "🏠", household: true },
  { id: "c_casa", kind: "expense", name: "Casa", icon: "🛋️", household: true },
  { id: "c_subs", kind: "expense", name: "Suscripciones", icon: "📺" },
  { id: "c_auto", kind: "expense", name: "Auto", icon: "🚗" },
  { id: "c_salud", kind: "expense", name: "Salud", icon: "🩺" },
  { id: "c_seguro", kind: "expense", name: "Seguros", icon: "🛡️" },
  { id: "c_gym", kind: "expense", name: "Gimnasio", icon: "🏋️" },
  { id: "c_ropa", kind: "expense", name: "Ropa", icon: "👕" },
  { id: "c_elec", kind: "expense", name: "Electrónica", icon: "📱" },
  { id: "c_regalo", kind: "expense", name: "Regalos", icon: "🎁" },
  { id: "c_viaje", kind: "expense", name: "Diversión / viajes", icon: "✈️" },
  { id: "c_trabajo", kind: "expense", name: "Trabajo / negocio", icon: "💼" },
  { id: "c_boda", kind: "expense", name: "Boda", icon: "💍" },
  { id: "c_otros", kind: "expense", name: "Otros", icon: "📦" },
  // ingresos
  { id: "i_trabajo", kind: "income", name: "Trabajo", icon: "💼", real: true },
  { id: "i_bono", kind: "income", name: "Bonificación", icon: "⭐", real: true },
  { id: "i_venta", kind: "income", name: "Venta", icon: "🏷️", real: true },
  { id: "i_regalo", kind: "income", name: "Regalo", icon: "🎁", real: true },
  { id: "i_aporte", kind: "income", name: "Aportación al fondo", icon: "🏠", real: false },
  { id: "i_reemb", kind: "income", name: "Reembolso", icon: "↩️", real: false },
  { id: "i_otro", kind: "income", name: "Otro ingreso", icon: "➕", real: true },
];

export const defaultState = () => ({
  schema: SCHEMA,
  createdAt: today(),
  settings: {
    name: "",
    partnerId: null,
    partnerPct: 40, // % que paga tu pareja en un gasto compartido
    corteFreq: "weekly", // weekly | biweekly | monthly
    corteStart: null, // fecha inicial del primer corte
    fund: { accountId: null, myPct: 60, budget: [] },
    lastBackup: null,
    limits: {}, // límite mensual por categoría (tu parte)
    theme: "dark",
  },
  accounts: [],
  categories: DEFAULT_CATEGORIES(),
  people: [],
  tx: [],
  msi: [],
  goals: [],
  cortes: [],
  subs: [],
});

let S = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    S = raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    S = null;
  }
  return S;
}

export const state = () => S;
export const hasData = () => !!S;

export function save() {
  if (!S) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    alert("No se pudo guardar en el teléfono (¿almacenamiento lleno?). Exporta un respaldo.");
  }
}

export function start(initial) {
  S = normalize(initial || defaultState());
  save();
  return S;
}

export function wipe() {
  localStorage.removeItem(KEY);
  S = null;
}

/** Completa campos faltantes para que respaldos viejos sigan funcionando. */
export function normalize(o) {
  const d = defaultState();
  const out = { ...d, ...o };
  out.settings = { ...d.settings, ...(o.settings || {}) };
  out.settings.fund = { ...d.settings.fund, ...((o.settings || {}).fund || {}) };
  for (const k of ["accounts", "categories", "people", "tx", "msi", "goals", "cortes", "subs"]) {
    if (!Array.isArray(out[k])) out[k] = d[k];
  }
  if (!out.categories.length) out.categories = DEFAULT_CATEGORIES();
  out.categories.forEach((c) => { if (!c.ico && CAT_ICO[c.id]) c.ico = CAT_ICO[c.id]; });
  out.settings.catUse ||= {};
  out.settings.limits ||= {};
  out.goals.forEach((g) => (g.contributions ||= []));
  out.tx.forEach((t) => (t.shares ||= []));
  out.msi.forEach((m) => (m.shares ||= []));
  out.schema = SCHEMA;
  return out;
}

export function validateBackup(o) {
  return o && typeof o === "object" && Array.isArray(o.accounts) && Array.isArray(o.tx);
}

// ---------- utilidades de colección ----------
export const byId = (coll, id) => S[coll].find((x) => x.id === id);
export function upsert(coll, item) {
  if (!item.id) item.id = uid();
  const i = S[coll].findIndex((x) => x.id === item.id);
  if (i >= 0) S[coll][i] = item;
  else S[coll].push(item);
  save();
  return item;
}
export function remove(coll, id) {
  S[coll] = S[coll].filter((x) => x.id !== id);
  save();
}
export const account = (id) => byId("accounts", id);
export const person = (id) => byId("people", id);
export const category = (id) => byId("categories", id);
export const partner = () => (S?.settings.partnerId ? person(S.settings.partnerId) : null);
