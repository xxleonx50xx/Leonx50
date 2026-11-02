// ================= Cuadra · app principal (ruteo y acciones) =================
import * as st from "./store.js";
import { uid } from "./store.js";
import { today, monthKey, shiftMonth, parseAmount } from "./format.js";
import { toast, closeSheet, sheetOpen } from "./ui.js";
import * as V from "./views.js";
import * as F from "./forms.js";
import { icon } from "./logos.js";
import { bindQuick, quickAdd } from "./quick.js";
import { brandFor } from "./logos.js";
const QuickBind = () => bindQuick(() => render(), (m, p) => F.openFull(m, p));

const $ = (s) => document.querySelector(s);
const deskMQ = window.matchMedia("(min-width: 1000px)");
let savedView = "list";
try { savedView = localStorage.getItem("cuadra_movview") || "list"; } catch {}
const ui = { movView: savedView, month: monthKey(today()), movFilter: { q: "", type: "", account: "", cat: "", all: false }, corteEnd: null, sort: { key: "date", dir: -1 }, desk: deskMQ.matches };

// ---------- Rutas: [regex, vista, pestaña móvil, sección de la barra lateral] ----------
const routes = [
  [/^#\/inicio$/, () => V.home(ui), "inicio", "inicio"],
  [/^#\/cuentas$/, () => V.accounts(ui), "cuentas", "cuentas"],
  [/^#\/cuadrar$/, () => V.reconcileList(), "cuentas", "cuentas"],
  [/^#\/cuenta\/(.+)$/, (m) => V.accountDetail(m[1], ui), "cuentas", "cuentas"],
  [/^#\/casa$/, () => V.casa(ui), "casa", "casa"],
  [/^#\/fondo$/, () => V.fund(ui), "casa", "casa"],
  [/^#\/personas$/, () => V.people(ui), "mas", "personas"],
  [/^#\/persona\/(.+)$/, (m) => V.personDetail(m[1], ui), "mas", "personas"],
  [/^#\/cortes$/, () => V.cortes(ui), "mas", "cortes"],
  [/^#\/mas$/, () => V.more(), "mas", ""],
  [/^#\/movs$/, () => V.movements(ui), "mas", "movs"],
  [/^#\/analisis$/, () => V.analysisView(ui), "mas", "analisis"],
  [/^#\/suscripciones$/, () => V.subsView(ui), "mas", "subs"],
  [/^#\/limites$/, () => V.limitsView(ui), "mas", "limites"],
  [/^#\/applepay$/, () => V.applePayGuide(), "mas", "ajustes"],
  [/^#\/metas$/, () => V.goals(), "mas", "metas"],
  [/^#\/meta\/(.+)$/, (m) => V.goalDetail(m[1]), "mas", "metas"],
  [/^#\/msi$/, () => V.msiList(ui), "mas", "msi"],
  [/^#\/categorias$/, () => V.categories(), "mas", "categorias"],
  [/^#\/respaldo$/, () => V.backup(), "mas", "respaldo"],
  [/^#\/ajustes$/, () => V.settings(), "mas", "ajustes"],
];

// ---------- Navegación (barra inferior móvil y barra lateral de escritorio) ----------
const TABS = [["inicio", "#/inicio", "layout-dashboard", "Inicio"], ["cuentas", "#/cuentas", "wallet", "Cuentas"], null, ["casa", "#/casa", "house", "Casa"], ["mas", "#/mas", "ellipsis", "Más"]];
const SIDE = [
  ["inicio", "#/inicio", "layout-dashboard", "Inicio"], ["movs", "#/movs", "list", "Movimientos"], ["cuentas", "#/cuentas", "wallet", "Cuentas"],
  ["casa", "#/casa", "house", "Casa"], ["personas", "#/personas", "users", "Personas"], ["cortes", "#/cortes", "scissors", "Cortes"],
  ["msi", "#/msi", "calendar", "MSI"], ["subs", "#/suscripciones", "repeat", "Suscripciones"], ["analisis", "#/analisis", "sliders-horizontal", "Análisis"], ["limites", "#/limites", "gauge", "Límites"], ["metas", "#/metas", "target", "Metas"], null,
  ["categorias", "#/categorias", "tag", "Categorías"], ["respaldo", "#/respaldo", "download", "Respaldo"], ["ajustes", "#/ajustes", "settings", "Ajustes"],
];
function buildNav() {
  $("#tabbar").innerHTML = TABS.map((t) => t ? `<a href="${t[1]}" data-tab="${t[0]}">${icon(t[2])}<span>${t[3]}</span></a>` : `<button id="fab" class="fab" aria-label="Registrar">${icon("plus")}</button>`).join("");
  $("#sidebar").innerHTML = `<div class="side-logo"><span class="lg-mark sm"></span><b>Cuadra</b></div>
    <button class="btn primary full side-add" data-act="add" data-kind="expense">${icon("plus")}<span>Registrar gasto</span><kbd>N</kbd></button>
    <nav>${SIDE.map((t) => t ? `<a href="${t[1]}" data-nav="${t[0]}">${icon(t[2])}<span>${t[3]}</span></a>` : `<hr/>`).join("")}</nav>`;
  $("#back").innerHTML = icon("chevron-left");
  $("#fab").addEventListener("click", () => F.openAdd("expense"));
}

let lastHash = "";
let rendering = false;
function render() {
  if (rendering) return void queueMicrotask(render); // evita re-render anidado (p. ej. blur → change)
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}
function applyTheme() {
  const t = st.state()?.settings.theme || "dark";
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.palette = st.state()?.settings.palette || "jade";
  const dark = t === "dark" || (t === "auto" && !matchMedia("(prefers-color-scheme: light)").matches);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#0a0b09" : "#f3f2ec");
}
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => applyTheme());
function renderNow() {
  applyTheme();
  if (!st.hasData()) return renderWelcome();
  if (location.hash.startsWith("#/nuevo")) return handleDeepLink();
  $("#app").classList.remove("hidden");
  $("#welcome").classList.add("hidden");
  const h = location.hash || "#/inicio";
  let view = null, tab = "inicio", nav = "inicio";
  for (const [re, fn, t, n] of routes) {
    const m = h.match(re);
    if (m) { view = fn(m); tab = t; nav = n; break; }
  }
  if (!view) { location.hash = "#/inicio"; return; }
  const main = $("#main");
  const keepScroll = h === lastHash;
  const y = main.scrollTop;
  $("#title").textContent = view.title;
  $("#back").classList.toggle("hidden", !view.back);
  $("#headAction").innerHTML = view.action || "";
  main.innerHTML = `<div class="view ${ui.desk ? "desk" : ""}">${view.html}</div>`;
  main.scrollTop = keepScroll ? y : 0;
  lastHash = h;
  document.querySelectorAll("#tabbar [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  document.querySelectorAll("#sidebar [data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === nav));
}
deskMQ.addEventListener("change", (e) => { ui.desk = e.matches; render(); });
QuickBind();
F.bindRefresh(render);

// ---------- Compras que llegan de fuera (Atajo de Apple Pay / buzón) ----------
function cleanAmount(v) {
  const m = String(v || "").replace(/[^0-9.,-]/g, "");
  // "1.234,50" o "1,234.50" → 1234.50
  const norm = /,\d{1,2}$/.test(m) && m.includes(".") ? m.replace(/\./g, "").replace(",", ".") : m.replace(/,/g, "");
  return parseAmount(norm);
}
function accountForCard(name) {
  const s = st.state();
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  const b = brandFor(n);
  const accs = s.accounts.filter((a) => !a.archived);
  return (b && accs.find((a) => brandFor(a.name)?.id === b.id && (a.type === "credit") === !/d[eé]bito/.test(n))) ||
    (b && accs.find((a) => brandFor(a.name)?.id === b.id)) ||
    accs.find((a) => n.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(n.split(" ")[0])) || null;
}
function purchasePreset(it) {
  const acc = accountForCard(it.tarjeta);
  return { amount: cleanAmount(it.monto) || "", concept: String(it.comercio || "").trim(), accountId: acc?.id, date: /^\d{4}-\d{2}-\d{2}$/.test(it.fecha || "") ? it.fecha : undefined, autofill: true };
}
function handleDeepLink() {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const it = { monto: q.get("monto") || q.get("amount"), comercio: q.get("comercio") || q.get("merchant"), tarjeta: q.get("tarjeta") || q.get("card"), fecha: q.get("fecha") };
  history.replaceState(null, "", location.pathname + "#/inicio");
  renderNow();
  setTimeout(() => quickAdd("expense", purchasePreset(it)), 50);
}
async function pullInbox() {
  const s = st.state();
  if (!s?.settings.inboxUrl || !s.settings.inboxToken) return;
  try {
    const r = await fetch(`${s.settings.inboxUrl}?token=${encodeURIComponent(s.settings.inboxToken)}`, { cache: "no-store" });
    const j = await r.json();
    if (j.items?.length) { s.inbox.push(...j.items); st.save(); render(); toast(`${j.items.length} compra(s) de Apple Pay por registrar`); }
  } catch {}
}
function openInboxItem(id) {
  const s = st.state();
  const it = s.inbox.find((x) => x.id === id);
  if (!it) return;
  quickAdd("expense", { ...purchasePreset(it), onSaved: () => { s.inbox = s.inbox.filter((x) => x.id !== id); st.save(); render(); } });
}
window.addEventListener("focus", pullInbox);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pullInbox(); });

// ---------- Recordatorios para el Calendario (.ics) ----------
function exportIcs() {
  const s = st.state();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const d0 = today().replace(/-/g, "");
  const ev = [];
  const add = (uidk, title, rrule, desc, start = d0, hour = 9) => ev.push([
    "BEGIN:VEVENT", `UID:cuadra-${uidk}@cuadra`, `DTSTAMP:${stamp}`, `DTSTART:${start}T${pad(hour)}0000`, `DURATION:PT15M`, `SUMMARY:${title}`,
    rrule ? `RRULE:${rrule}` : "", desc ? `DESCRIPTION:${desc}` : "",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "TRIGGER:-P1D", "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n"));
  for (const a of s.accounts.filter((x) => x.type === "credit" && !x.archived && x.dueDay && Math.abs(Number(x.initial) || 0) + 1 > 0))
    add(`pago-${a.id}`, `Pagar ${a.name}`, `FREQ=MONTHLY;BYMONTHDAY=${a.dueDay}`, "Fecha límite de pago (Cuadra)");
  const p = st.partner();
  if (p) {
    const freq = s.settings.corteFreq;
    const start = s.cortes.length ? [...s.cortes].sort((a, b) => (a.end < b.end ? 1 : -1))[0].end : s.settings.corteStart || today();
    const first = new Date(start + "T12:00"); first.setDate(first.getDate() + (freq === "monthly" ? 30 : freq === "biweekly" ? 14 : 7) - (s.cortes.length ? 0 : 1));
    const f = `${first.getFullYear()}${pad(first.getMonth() + 1)}${pad(first.getDate())}`;
    add("corte", `Cerrar corte con ${p.name}`, freq === "monthly" ? "FREQ=MONTHLY" : `FREQ=WEEKLY;INTERVAL=${freq === "biweekly" ? 2 : 1}`, "Abre Cuadra → Cortes", f, 20);
  }
  const renta = (s.settings.fund.budget || []).find((b) => b.categoryId === "c_renta");
  if (renta) add("renta", `Renta $${renta.amount}`, "FREQ=MONTHLY;BYMONTHDAY=1", "Tú 60% · Liz 40%");
  for (const x of (s.subs || []).filter((x) => x.active && x.day)) add(`sub-${x.id}`, `Cobro ${x.name} $${x.amount}`, `FREQ=MONTHLY;BYMONTHDAY=${x.day}`, x.accountId ? `Tarjeta: ${st.account(x.accountId)?.name || ""}` : "");
  for (const pp of s.people.filter((x) => x.plan && !x.archived)) {
    const day = Number(pp.plan.start.slice(8, 10));
    const days = pp.plan.freq === "quincenal" ? `${day},${Math.min(28, ((day + 14) % 30) + 1)}` : `${day}`;
    add(`plan-${pp.id}`, `Pago de ${pp.name} $${pp.plan.amount}`, pp.plan.freq === "semanal" ? "FREQ=WEEKLY" : `FREQ=MONTHLY;BYMONTHDAY=${days}`, "Registra el abono en Cuadra");
  }
  const nextSun = new Date(); nextSun.setDate(nextSun.getDate() + ((7 - nextSun.getDay()) % 7));
  add("cuadrar", "Cuadrar cuentas en Cuadra", "FREQ=WEEKLY;BYDAY=SU", "Compara tus saldos con el banco", `${nextSun.getFullYear()}${pad(nextSun.getMonth() + 1)}${pad(nextSun.getDate())}`, 20);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cuadra//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Cuadra", ...ev, "END:VCALENDAR"].join("\r\n");
  shareOrDownload(new Blob([ics], { type: "text/calendar" }), "cuadra-recordatorios.ics");
}

// ---------- Bienvenida ----------
function renderWelcome() {
  $("#app").classList.add("hidden");
  $("#welcome").classList.remove("hidden");
}
function startFresh() {
  const name = $("#wName").value.trim();
  const partner = $("#wPartner").value.trim();
  const s = st.defaultState();
  s.settings.name = name;
  if (partner) {
    const p = { id: uid(), name: partner, relation: "Pareja", initial: 0, plan: null };
    s.people.push(p);
    s.settings.partnerId = p.id;
  }
  st.start(s);
  location.hash = "#/inicio";
  render();
  toast("¡Listo! Ahora agrega tus cuentas");
}

// ---------- Respaldo ----------
async function exportBackup() {
  const s = st.state();
  s.settings.lastBackup = today();
  st.save();
  const blob = new Blob([JSON.stringify(s, null, 1)], { type: "application/json" });
  await shareOrDownload(blob, `cuadra-respaldo-${today()}.json`);
  render();
}
async function exportCsv() {
  const s = st.state();
  const acc = (id) => st.account(id)?.name || "";
  const cat = (id) => st.category(id)?.name || "";
  const per = (id) => st.person(id)?.name || "";
  const TYPES = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia", adjust: "Ajuste", lend: "Préstamo dado", collect: "Cobro", borrow: "Préstamo recibido", repay: "Pago a persona", debt: "Deuda" };
  const rows = [["Fecha", "Tipo", "Concepto", "Monto", "Cuenta", "Cuenta destino", "Categoría", "Persona", "Parte de otros", "Nota"]];
  for (const t of [...s.tx].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    rows.push([t.date, TYPES[t.type] || t.type, t.concept || "", t.amount, acc(t.accountId), acc(t.toAccountId), cat(t.categoryId),
      per(t.personId) || (t.shares || []).map((x) => per(x.personId)).join(" "), (t.shares || []).reduce((q, x) => q + (x.amount || 0), 0) || "", t.note || ""]);
  }
  for (const m of s.msi) rows.push([m.date, `Compra MSI ${m.months}m`, m.concept || "", m.total, acc(m.accountId), "", cat(m.categoryId), (m.shares || []).map((x) => `${per(x.personId)} ${x.pct}%`).join(" "), "", ""]);
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  await shareOrDownload(new Blob([csv], { type: "text/csv" }), `cuadra-movimientos-${today()}.csv`);
}
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast("Archivo descargado");
}
function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (!st.validateBackup(o)) throw new Error("formato");
      if (st.hasData() && st.state().tx.length && !confirm("Esto reemplazará TODOS tus datos actuales por los del respaldo. ¿Continuar?")) return;
      st.start(o);
      location.hash = "#/inicio";
      render();
      toast(`Respaldo importado: ${o.accounts.length} cuentas, ${o.tx.length} movimientos`);
    } catch {
      alert("Ese archivo no es un respaldo válido de Cuadra.");
    }
  };
  r.readAsText(file);
}

// ---------- Acciones (delegación de eventos) ----------
const actions = {
  tx: (d) => F.openTx(st.byId("tx", d.id)),
  msi: (d) => F.msiForm(st.byId("msi", d.id)),
  add: (d) => F.openAdd(d.kind, {
    ...(d.acc ? { accountId: d.acc } : {}), ...(d.to ? { toAccountId: d.to } : {}),
    ...(d.person ? { personId: d.person } : {}), ...(d.pkind ? { kind: d.pkind } : {}), ...(d.split ? { split: d.split } : {}),
    ...(d.payer ? { payer: d.payer } : {}),
  }),
  sort: (d) => { ui.sort = { key: d.key, dir: ui.sort.key === d.key ? -ui.sort.dir : -1 }; render(); },
  inlineAdd: () => inlineAdd(),
  newAccount: () => F.accountForm(),
  editAccount: (d) => F.accountForm(st.account(d.id)),
  reconcile: (d) => F.reconcileForm(d.id),
  newPerson: () => F.personForm(),
  editPerson: (d) => F.personForm(st.person(d.id)),
  newGoal: () => F.goalForm(),
  editGoal: (d) => F.goalForm(st.byId("goals", d.id)),
  contrib: (d) => { const g = st.byId("goals", d.id); F.contributionForm(g, d.cid ? g.contributions.find((c) => c.id === d.cid) : null); },
  budget: () => F.budgetForm(),
  newSub: () => F.subForm(),
  editSub: (d) => F.subForm(st.byId("subs", d.id)),
  anMonths: (d) => { ui.anMonths = Number(d.n); render(); },
  editLimits: () => F.limitsForm(),
  exportIcs: () => exportIcs(),
  inboxItem: (d) => openInboxItem(d.id),
  filterCat: (d) => { ui.movFilter.cat = ui.movFilter.cat === d.id ? "" : d.id; render(); },
  movView: (d) => { ui.movView = d.v; try { localStorage.setItem("cuadra_movview", d.v); } catch {} render(); },
  anExtra: () => { ui.anExtra = ui.anExtra === false; render(); },
  newCat: (d) => F.categoryForm(null, d.kind),
  editCat: (d) => F.categoryForm(st.category(d.id)),
  month: (d) => { ui.month = shiftMonth(ui.month, Number(d.d)); render(); },
  toggleAll: () => { ui.movFilter.all = !ui.movFilter.all; render(); },
  closeCorte: (d) => F.closeCorteForm(d.start, d.end),
  reopenCorte: (d) => {
    const s = st.state();
    const c = s.cortes.find((x) => x.id === d.id);
    if (!c) return;
    const delPay = c.txId && confirm("¿Borrar también el pago registrado al cerrar ese corte?\n\nAceptar = borrar pago · Cancelar = conservarlo");
    if (delPay) st.remove("tx", c.txId);
    st.remove("cortes", c.id);
    ui.corteEnd = c.end;
    render();
    toast("Corte reabierto");
  },
  newFundAccount: () => {
    const s = st.state();
    const a = { id: uid(), name: "Fondo común", type: "fund", initial: 0, initialDate: today() };
    st.upsert("accounts", a);
    s.settings.fund.accountId = a.id;
    st.save();
    render();
    F.budgetForm();
  },
  export: exportBackup,
  exportCsv,
  wipe: () => {
    if (!confirm("¿Borrar TODOS los datos de este teléfono? No se puede deshacer.")) return;
    if (prompt('Escribe BORRAR para confirmar') !== "BORRAR") return;
    st.wipe();
    location.hash = "";
    render();
  },
};

document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go && !e.target.closest("[data-act]")) { location.hash = go.dataset.go; return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset); }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.act === "import") return importBackup(el.files[0]);
  if (el.dataset.act === "corteEnd") { ui.corteEnd = el.value || null; return render(); }
  if (el.dataset.act === "pickFund" && el.value) { st.state().settings.fund.accountId = el.value; st.save(); render(); return F.budgetForm(); }
  if (el.dataset.filter && el.dataset.filter !== "q") { ui.movFilter[el.dataset.filter] = el.value; return render(); }
  if (el.dataset.setting) {
    const s = st.state(), k = el.dataset.setting, v = el.value;
    if (k === "nwExcludeMsi") s.settings.nwExcludeMsi = v === "1";
    else if (k === "inboxUrl") s.settings.inboxUrl = v.trim();
    else if (k === "partnerPct") s.settings.partnerPct = Math.max(0, Math.min(100, parseAmount(v) || 0));
    else if (k === "fundPct") s.settings.fund.myPct = Math.max(0, Math.min(100, parseAmount(v) || 0));
    else s.settings[k] = v || null;
    if (k === "name") s.settings.name = v.trim();
    st.save();
    if (k === "theme" || k === "palette") render();
    toast("Guardado");
  }
});
let searchT = null;
document.addEventListener("input", (e) => {
  if (e.target.dataset.filter === "q") {
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      ui.movFilter.q = e.target.value;
      render();
      const inp = document.querySelector('[data-filter="q"]');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 250);
  }
});

$("#back").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/inicio")));
buildNav();
// atajo de teclado (escritorio): N = registrar gasto
document.addEventListener("keydown", (e) => {
  if (sheetOpen() || e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) {
    if (e.key === "Enter" && document.activeElement?.closest("#inlineAdd")) { e.preventDefault(); inlineAdd(); }
    return;
  }
  if (e.key === "n" || e.key === "N") { e.preventDefault(); F.openAdd("expense"); }
});

// ---------- Fila para capturar gastos directo en la tabla (escritorio) ----------
function inlineAdd() {
  const row = document.getElementById("inlineAdd");
  if (!row) return;
  const g = (n) => row.querySelector(`[name="${n}"]`);
  const amount = parseAmount(g("ia_amount").value);
  if (!(amount > 0)) { g("ia_amount").focus(); return toast("Escribe el monto"); }
  const s = st.state();
  const pid = s.settings.partnerId;
  const split = g("ia_split").value;
  const pct = split === "partner" ? Number(s.settings.partnerPct) : split === "half" ? 50 : split === "partner100" ? 100 : split === "house" ? 100 - Number(s.settings.fund.myPct) : 0;
  const accountId = g("ia_acc").value;
  st.upsert("tx", {
    id: uid(), type: "expense", amount, accountId, categoryId: g("ia_cat").value, concept: g("ia_concept").value.trim(), date: g("ia_date").value || today(),
    house: split === "house" || accountId === s.settings.fund.accountId,
    shares: pct && pid ? [{ personId: pid, pct, amount: Math.round(amount * pct) / 100 }] : [], createdAt: Date.now(),
  });
  s.settings.lastAccountId = accountId;
  st.save();
  render();
  toast("Gasto agregado");
  setTimeout(() => document.querySelector('#inlineAdd [name="ia_concept"]')?.focus(), 30);
}
$("#wStart").addEventListener("click", startFresh);
$("#wImport").addEventListener("change", (e) => importBackup(e.target.files[0]));
window.addEventListener("hashchange", () => { if (sheetOpen()) closeSheet(true); if (!location.hash.startsWith("#/cortes")) ui.corteEnd = null; render(); });
window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("cuadra_")) { st.load(); render(); } });

// ---------- Service worker (offline) ----------
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloaded || sheetOpen()) return; reloaded = true; location.reload(); });
  }
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((reg) => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) nw.postMessage("skipWaiting"); });
    });
  }).catch(() => {});
}

// ---------- Arranque ----------
st.load();
navigator.storage?.persist?.().catch(() => {});
render();
registerSW();
pullInbox();
