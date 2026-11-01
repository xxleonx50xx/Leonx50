// ================= Cuadra · app principal (ruteo y acciones) =================
import * as st from "./store.js";
import { uid } from "./store.js";
import { today, monthKey, shiftMonth, parseAmount } from "./format.js";
import { toast, closeSheet, sheetOpen } from "./ui.js";
import * as V from "./views.js";
import * as F from "./forms.js";

const $ = (s) => document.querySelector(s);
const ui = { month: monthKey(today()), movFilter: { q: "", type: "", account: "", all: false }, corteEnd: null };

// ---------- Rutas ----------
const routes = [
  [/^#\/inicio$/, () => V.home(ui), "inicio"],
  [/^#\/cuentas$/, () => V.accounts(), "cuentas"],
  [/^#\/cuadrar$/, () => V.reconcileList(), "cuentas"],
  [/^#\/cuenta\/(.+)$/, (m) => V.accountDetail(m[1]), "cuentas"],
  [/^#\/personas$/, () => V.people(), "personas"],
  [/^#\/persona\/(.+)$/, (m) => V.personDetail(m[1]), "personas"],
  [/^#\/cortes$/, () => V.cortes(ui), "personas"],
  [/^#\/mas$/, () => V.more(), "mas"],
  [/^#\/movs$/, () => V.movements(ui), "mas"],
  [/^#\/fondo$/, () => V.fund(ui), "mas"],
  [/^#\/metas$/, () => V.goals(), "mas"],
  [/^#\/meta\/(.+)$/, (m) => V.goalDetail(m[1]), "mas"],
  [/^#\/msi$/, () => V.msiList(), "mas"],
  [/^#\/categorias$/, () => V.categories(), "mas"],
  [/^#\/respaldo$/, () => V.backup(), "mas"],
  [/^#\/ajustes$/, () => V.settings(), "mas"],
];

let lastHash = "";
let rendering = false;
function render() {
  if (rendering) return void queueMicrotask(render); // evita re-render anidado (p. ej. blur → change)
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}
function renderNow() {
  if (!st.hasData()) return renderWelcome();
  $("#app").classList.remove("hidden");
  $("#welcome").classList.add("hidden");
  const h = location.hash || "#/inicio";
  let view = null, tab = "inicio";
  for (const [re, fn, t] of routes) {
    const m = h.match(re);
    if (m) { view = fn(m); tab = t; break; }
  }
  if (!view) { location.hash = "#/inicio"; return; }
  const main = $("#main");
  const keepScroll = h === lastHash;
  const y = main.scrollTop;
  $("#title").textContent = view.title;
  $("#back").classList.toggle("hidden", !view.back);
  $("#headAction").innerHTML = view.action || "";
  main.innerHTML = `<div class="view">${view.html}</div>`;
  main.scrollTop = keepScroll ? y : 0;
  lastHash = h;
  document.querySelectorAll(".tabbar [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
}
F.bindRefresh(render);

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
  }),
  newAccount: () => F.accountForm(),
  editAccount: (d) => F.accountForm(st.account(d.id)),
  reconcile: (d) => F.reconcileForm(d.id),
  newPerson: () => F.personForm(),
  editPerson: (d) => F.personForm(st.person(d.id)),
  newGoal: () => F.goalForm(),
  editGoal: (d) => F.goalForm(st.byId("goals", d.id)),
  contrib: (d) => { const g = st.byId("goals", d.id); F.contributionForm(g, d.cid ? g.contributions.find((c) => c.id === d.cid) : null); },
  budget: () => F.budgetForm(),
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
    if (k === "partnerPct") s.settings.partnerPct = Math.max(0, Math.min(100, parseAmount(v) || 0));
    else if (k === "fundPct") s.settings.fund.myPct = Math.max(0, Math.min(100, parseAmount(v) || 0));
    else s.settings[k] = v || null;
    if (k === "name") s.settings.name = v.trim();
    st.save();
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
$("#fab").addEventListener("click", () => F.addMenu());
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
