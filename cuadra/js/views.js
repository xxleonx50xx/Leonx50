// ================= Vistas (pantallas) =================
// Cada vista devuelve { title, html, back?, action? }. Con ui.desk = true
// (pantalla ancha) las listas se muestran como tablas.
import * as st from "./store.js";
import { ACCOUNT_TYPES } from "./store.js";
import { esc, money, money0, moneySigned, fmtDate, fmtMonth, fmtRange, relDays, today, daysBetween, monthKey, DIAS_L } from "./format.js";
import { bar, kv, moneyCls } from "./ui.js";
import {
  compute, cardInfo, msiInfo, personEvents, planInfo, monthStats, corteSummary, openCorteStart, corteDefaultEnd,
  fundStats, goalProgress, naturalBalance, txAccountEffects, EVENT_LABEL, houseStats, houseLine, isHouse, categoriesByUse,
  analysis, subInfo, subMonthly, limitsStatus,
} from "./calc.js";
import { icon, brandFor, logo, iconTile, colorTile, APPLE, CAT_COLOR } from "./logos.js";
import { accountTile, categoryTile } from "./quick.js";

const S = () => st.state();
const catOf = (id) => st.category(id);
const accName = (id) => st.account(id)?.name || "—";
const pName = (id) => st.person(id)?.name || "—";
const empty = (ico, title, text, btn = "") => `<div class="empty">${iconTile(ico, "accent", "lg")}<h4>${esc(title)}</h4><p>${text}</p>${btn}</div>`;
const section = (title, inner, action = "", cls = "") => `<section class="sec ${cls}"><div class="sec-h"><h3>${esc(title)}</h3>${action}</div>${inner}</section>`;
const link = (label, go) => `<a class="sec-link" href="${go}">${esc(label)}</a>`;
const btn = (label, attrs, cls = "", ico = "") => `<button class="btn ${cls}" ${attrs}>${ico ? icon(ico) : ""}<span>${label}</span></button>`;

/** Tabla genérica para escritorio. cols: [{label, cls, sort}], rows: [{cells, attrs}] */
function table(cols, rows, { sort, foot = "", head = "" } = {}) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => {
    const s = c.sort ? ` data-act="sort" data-key="${c.sort}"` : "";
    const arrow = c.sort && sort?.key === c.sort ? (sort.dir > 0 ? " ↑" : " ↓") : "";
    return `<th class="${c.cls || ""}${c.sort ? " sortable" : ""}"${s}>${c.label}${arrow}</th>`;
  }).join("")}</tr>${head}</thead><tbody>${rows.length ? rows.map((r) => `<tr ${r.attrs || ""}>${r.cells.map((x, i) => `<td class="${cols[i].cls || ""}">${x}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="muted center">Sin datos</td></tr>`}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ""}</table></div>`;
}

// ---------- Movimientos ----------
const TYPE_ICO = { expense: "receipt", income: "arrow-down-left", transfer: "arrow-left-right", adjust: "scale", lend: "hand-coins", collect: "hand-coins", borrow: "hand-coins", repay: "hand-coins", debt: "users" };
const TYPE_LBL = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia", adjust: "Ajuste", lend: "Préstamo", collect: "Cobro", borrow: "Me prestó", repay: "Pago", debt: "Deuda" };
export function txTile(t, size = "") {
  const b = brandFor(t.concept);
  if (b) return logo(b, size);
  if (t.type === "transfer") { const to = st.account(t.toAccountId); if (to?.type === "credit") return accountTile(to, size); }
  if (t.categoryId && catOf(t.categoryId)) return categoryTile(catOf(t.categoryId), size);
  return iconTile(TYPE_ICO[t.type] || "receipt", "", size);
}
function txTitle(t) {
  if (t.concept) return t.concept;
  if (t.type === "transfer") return st.account(t.toAccountId)?.type === "credit" ? `Pago ${accName(t.toAccountId)}` : "Transferencia";
  if (t.type === "adjust") return "Ajuste";
  if (["lend", "collect", "borrow", "repay", "debt"].includes(t.type)) return pName(t.personId);
  return catOf(t.categoryId)?.name || "Movimiento";
}
function txSub(t) {
  const bits = [];
  const c = catOf(t.categoryId);
  if (t.type === "transfer") bits.push(`${accName(t.accountId)} → ${accName(t.toAccountId)}`);
  else if (t.accountId) bits.push(accName(t.accountId));
  if (c && t.type !== "transfer") bits.push(c.name);
  if (t.type === "lend") bits.push(`Le prestaste a ${pName(t.personId)}`);
  if (t.type === "collect") bits.push(`${pName(t.personId)} te pagó`);
  if (t.type === "borrow") bits.push(`${pName(t.personId)} te prestó`);
  if (t.type === "repay") bits.push(`Le pagaste a ${pName(t.personId)}`);
  if (t.type === "debt") bits.push(t.dir === "iOwe" ? `Pagó ${pName(t.personId)}` : `${pName(t.personId)} te debe`);
  if (t.type === "income" && t.personId) bits.push(`de ${pName(t.personId)}`);
  if (t.reconcile) bits.push("cuadre");
  return bits.join(" · ");
}
function txAmountVal(t, accountId) {
  if (accountId) return txAccountEffects(t).filter(([id]) => id === accountId).reduce((s, [, x]) => s + x, 0);
  const a = Number(t.amount);
  if (["expense", "lend", "repay"].includes(t.type)) return -a;
  if (["income", "collect", "borrow"].includes(t.type)) return a;
  if (t.type === "adjust") return a;
  return null; // transfer / debt: neutro
}
function txAmount(t, accountId) {
  const v = txAmountVal(t, accountId);
  if (v == null) return `<b class="amt muted">${money(t.type === "debt" && t.total ? t.total : t.amount)}</b>`;
  return `<b class="amt ${v > 0 ? "pos" : ""}">${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}</b>`;
}
function splitBadge(t) {
  const out = [];
  if (t.hist) out.push(`<span class="tag">histórico</span>`);
  if (t.extra) out.push(`<span class="tag extra">extraordinario</span>`);
  if (t.excluded) out.push(`<span class="tag">${esc(t.excludedReason || "no es gasto tuyo")}</span>`);
  if (isHouse(S(), t)) out.push(`<span class="tag house">${icon("house")}Casa</span>`);
  for (const x of t.shares || []) if (x.amount) out.push(`<span class="tag">${esc(pName(x.personId))} ${money0(x.amount)}</span>`);
  if (t.type === "debt" && t.dir === "iOwe" && t.total) out.push(`<span class="tag">tu parte ${money0(t.amount)}</span>`);
  return out.join("");
}
export function txRow(t, { accountId, running } = {}) {
  return `<div class="swipe" data-id="${t.id}"><div class="sw-acts"><button data-sw="dup">${icon("repeat")}<span>Duplicar</span></button><button data-sw="del" class="del">${icon("trash-2")}<span>Eliminar</span></button></div><button class="row tx" data-act="tx" data-id="${t.id}">
    ${txTile(t)}
    <div class="mid"><div class="t1">${esc(txTitle(t))}</div><div class="t2">${esc(txSub(t))}</div>${splitBadge(t) ? `<div class="t3">${splitBadge(t)}</div>` : ""}</div>
    <div class="end">${txAmount(t, accountId)}${running != null ? `<small>${money(running)}</small>` : ""}</div>
  </button></div>`;
}
function txTableRow(t, { accountId, running } = {}) {
  const c = catOf(t.categoryId);
  return {
    attrs: `data-act="tx" data-id="${t.id}" class="click"`,
    cells: [
      `<span class="nowrap">${fmtDate(t.date, { plain: true })}</span>`,
      `<div class="cell-main">${txTile(t, "xs")}<div><b>${esc(txTitle(t))}</b>${t.note ? `<small>${esc(t.note)}</small>` : ""}</div></div>`,
      c ? `<span class="cat-chip">${c.ico ? icon(c.ico) : esc(c.icon)}${esc(c.name)}</span>` : `<span class="muted">${TYPE_LBL[t.type] || ""}</span>`,
      t.type === "transfer" ? `${esc(accName(t.accountId))} → ${esc(accName(t.toAccountId))}` : t.accountId ? esc(accName(t.accountId)) : `<span class="muted">${t.personId ? esc(pName(t.personId)) : "—"}</span>`,
      splitBadge(t) || `<span class="muted">—</span>`,
      txAmount(t, accountId),
      ...(running != null ? [`<span class="muted">${money(running)}</span>`] : []),
    ],
  };
}
const TX_COLS = [
  { label: "Fecha", sort: "date", cls: "w-date" }, { label: "Concepto" }, { label: "Categoría" }, { label: "Cuenta" },
  { label: "Reparto" }, { label: "Monto", sort: "amount", cls: "num" },
];

function msiInfoRow(m, C) {
  const i = C.msi[m.id];
  const who = (m.shares || []).map((x) => `<span class="tag">${esc(pName(x.personId))} ${x.pct}%</span>`).join("");
  return `<button class="row" data-act="msi" data-id="${m.id}">
    ${brandFor(m.concept) ? logo(brandFor(m.concept)) : categoryTile(catOf(m.categoryId))}
    <div class="mid"><div class="t1">${esc(m.concept || "Compra a MSI")}</div>
      <div class="t2">${esc(accName(m.accountId))} · ${i.paid}/${i.months} · ${money(i.monthly)}/mes</div>
      ${who ? `<div class="t3">${who}</div>` : ""}${bar((i.paid / i.months) * 100, i.done ? "done" : "")}</div>
    <div class="end"><b class="amt">${money(i.remaining)}</b><small>${i.done ? "liquidada" : i.nextDate ? `sig. ${fmtDate(i.nextDate)}` : ""}</small></div>
  </button>`;
}
function groupByDate(list, render) {
  let out = "", cur = null;
  for (const t of list) {
    if (t.date !== cur) { cur = t.date; out += `<div class="day">${fmtDate(cur, { weekday: true })}</div>`; }
    out += render(t);
  }
  return out;
}
const sortTx = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0));

// ================= INICIO =================
/** Plástico de tarjeta con el color del banco. */
export function bankCard(a, C, { compact = false } = {}) {
  const s = S();
  const b = brandFor(a.name);
  const hex = b?.hex || (a.type === "credit" ? "#2a3330" : "#13362a");
  const credit = a.type === "credit";
  const ci = credit ? cardInfo(s, a, C) : null;
  const val = credit ? ci.debt : C.acc[a.id];
  const stale = !a.lastReconciled || daysBetween(a.lastReconciled, today()) > 7;
  return `<a class="bcard ${compact ? "compact" : ""}" href="#/cuenta/${a.id}" style="--bc:${hex}">
    <div class="bc-top">${accountTile(a, "sm")}<span class="bc-name">${esc(a.name)}</span>${stale ? `<span class="bc-flag" title="Sin cuadrar">${icon("scale")}</span>` : `<span class="bc-ok">${icon("circle-check")}</span>`}</div>
    <div class="bc-mid"><small>${credit ? "Deuda" : ACCOUNT_TYPES[a.type].label}</small><b>${money(val)}</b></div>
    ${credit && ci.limit ? `<div class="bc-bot"><div class="bc-bar"><i style="width:${ci.usedPct.toFixed(1)}%"></i></div><small>Disponible ${money0(ci.available)}${ci.nextDue ? ` · paga ${fmtDate(ci.nextDue, { plain: true })}` : ""}</small></div>`
      : `<div class="bc-bot"><small>${a.lastReconciled ? `Cuadrada ${relDays(a.lastReconciled)}` : "Sin cuadrar"}</small></div>`}
  </a>`;
}

/** Próximos cobros: pagos de tarjetas, suscripciones, MSI y planes de pago. */
function upcoming(s, C, days = 14) {
  const lim = addDaysLocal(today(), days);
  const ev = [];
  for (const a of s.accounts.filter((x) => !x.archived && x.type === "credit")) {
    const ci = cardInfo(s, a, C);
    if (ci.nextDue && ci.nextDue <= lim && ci.debt > 0) ev.push({ date: ci.nextDue, tile: accountTile(a, "sm"), title: `Pagar ${a.name}`, sub: `Sin MSI + mensualidades ${money0(ci.debtNoMsi + ci.msiMonthly)}`, amount: ci.debt, go: `#/cuenta/${a.id}` });
    if (ci.nextCut && ci.nextCut <= lim) ev.push({ date: ci.nextCut, tile: accountTile(a, "sm"), title: `Corte ${a.name}`, sub: "Fecha de corte", amount: null, go: `#/cuenta/${a.id}` });
  }
  for (const x of (s.subs || []).filter((x) => x.active && x.day)) {
    const i = subInfo(s, x, brandFor);
    if (i.next && i.next <= lim) ev.push({ date: i.next, tile: brandFor(x.name) ? logo(brandFor(x.name), "sm") : iconTile("repeat", "", "sm"), title: x.name, sub: x.accountId ? accName(x.accountId) : "Suscripción", amount: Number(x.amount), go: "#/suscripciones" });
  }
  for (const p of s.people.filter((p) => p.plan && !p.archived)) {
    const pi = planInfo(s, p);
    if (pi?.next && pi.next <= lim) ev.push({ date: pi.next, tile: `<span class="avatar xs">${esc(p.name[0])}</span>`, title: `Pago de ${p.name}`, sub: "Te debe pagar", amount: pi.amount, go: `#/persona/${p.id}`, inc: true });
  }
  return ev.sort((a, b) => (a.date < b.date ? -1 : 1));
}
function addDaysLocal(d, n) { const x = new Date(d + "T12:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }

export function home(ui) {
  const s = S();
  const C = compute(s);
  if (!s.accounts.length) {
    return { title: "Inicio", html: empty("wallet", `Hola${s.settings.name ? ", " + s.settings.name : ""}`, "Empieza agregando tus cuentas: débito, tarjetas de crédito, efectivo y tu fondo común.", `<button class="btn primary" data-act="newAccount">${icon("plus")}<span>Agregar cuenta</span></button><a class="btn ghost" href="#/respaldo">Importar respaldo</a>`) };
  }
  const active = s.accounts.filter((a) => !a.archived);
  const assets = active.filter((a) => a.type !== "credit").reduce((x, a) => x + C.acc[a.id], 0);
  const cardDebtFull = active.filter((a) => a.type === "credit").reduce((x, a) => x + Math.max(0, -C.acc[a.id]), 0);
  const cardDebt = C.nwNoMsi ? cardDebtFull - C.msiDebt : cardDebtFull;
  const stale = active.filter((a) => !a.lastReconciled || daysBetween(a.lastReconciled, today()) > 7);
  const backupOld = s.tx.filter((t) => !t.hist).length > 5 && (!s.settings.lastBackup || daysBetween(s.settings.lastBackup, today()) > 7);
  const p = st.partner();

  // 1. Encabezado con patrimonio
  const head = `
    <section class="nw">
      <small>Patrimonio neto${C.nwNoMsi ? " · sin MSI" : ""}</small>
      <div class="nw-big ${C.netWorth < 0 ? "neg" : ""}">${money(C.netWorth)}</div>
      <div class="nw-row">
        <a href="#/cuentas"><small>Tengo</small><b>${money0(assets)}</b></a><i></i>
        <a href="#/msi"><small>${C.nwNoMsi ? (cardDebt < 0 ? "A favor (sin MSI)" : "Debo (sin MSI)") : "Debo"}</small><b class="${cardDebt < 0 ? "pos" : "neg"}">${money0(Math.abs(cardDebt))}</b></a><i></i>
        <a href="#/personas"><small>Me deben</small><b class="pos">${money0(C.owedToMe)}</b></a>
      </div>
    </section>`;
  // 2. Cartera
  const order = ["debit", "cash", "credit", "fund", "savings"];
  const accs = [...active].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || Math.abs(C.acc[b.id]) - Math.abs(C.acc[a.id]));
  const wallet = `<section class="wallet-sec"><div class="sec-h"><h3>Mis cuentas</h3><a class="sec-link" href="#/cuadrar">${icon("scale")} Cuadrar${stale.length ? ` (${stale.length})` : ""}</a></div>
    <div class="wallet">${accs.map((a) => bankCard(a, C)).join("")}<a class="bcard add" href="#/cuentas">${icon("plus")}<span>Ver todas</span></a></div></section>`;
  // 3. Acciones
  const quick = `<div class="actions-row">
    <button data-act="add" data-kind="expense"><span>${icon("receipt")}</span>Gasto</button>
    ${p ? `<button data-act="add" data-kind="house"><span>${icon("house")}</span>Casa</button>` : ""}
    <button data-act="add" data-kind="payment"><span>${icon("credit-card")}</span>Pagar</button>
    <button data-act="add" data-kind="income"><span>${icon("arrow-down-left")}</span>Ingreso</button>
  </div>`;
  let alerts = "";
  if (s.inbox?.length) alerts += `<div class="card inbox-card"><div class="sec-h" style="margin:0 0 6px"><h3 style="font-size:17px">Compras de Apple Pay por registrar</h3></div>${s.inbox.slice(0, 5).map((it) => `<button class="row" data-act="inboxItem" data-id="${esc(it.id)}">${brandFor(it.comercio) ? logo(brandFor(it.comercio)) : iconTile("credit-card")}<div class="mid"><div class="t1">${esc(it.comercio || "Compra")}</div><div class="t2">${esc(it.tarjeta || "")} · ${esc(it.fecha || "")}</div></div><div class="end"><b class="amt">${esc(it.monto || "")}</b><small>Registrar</small></div></button>`).join("")}</div>`;
  if (backupOld) alerts += `<a class="banner warn" href="#/respaldo">${icon("triangle-alert")}<span>Haz un respaldo — ${s.settings.lastBackup ? `el último fue ${relDays(s.settings.lastBackup)}` : "aún no tienes ninguno"}</span></a>`;
  // 4. Este mes vs promedio
  const A = analysis(s, 6, brandFor);
  const curM = A.byMonth[A.cur];
  const ms = monthStats(s, monthKey(today()));
  const pace = A.avg ? (curM.spend / A.avg) * 100 : 0;
  const dayPct = (new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100;
  const month = `<a class="card month-card" href="#/analisis">
    <div class="mc-top"><span>${fmtMonth(A.cur)}</span>${icon("chevron-right", "dim")}</div>
    <div class="mc-big">${money0(curM.spend)} <small>gastado</small></div>
    <div class="pace"><div class="bar ${pace > dayPct + 10 ? "hot" : ""}"><i style="width:${Math.min(100, pace).toFixed(1)}%"></i></div><span class="pace-mark" style="left:${dayPct.toFixed(1)}%"></span></div>
    <div class="mc-foot"><span>Promedio mensual ${money0(A.avg)}</span><span>Tu parte ${money0(ms.spend)}</span></div>
  </a>`;
  // 5. Pareja
  let partner = "";
  if (p) {
    const start = openCorteStart(s);
    const end = corteDefaultEnd(start, s.settings.corteFreq);
    const bal = C.ppl[p.id];
    const due = today() > end;
    partner = `<a class="card row-card" href="#/cortes"><span class="avatar">${esc(p.name[0])}</span>
      <div class="mid"><b>Corte con ${esc(p.name)}</b><small>${fmtRange(start, end)}${due ? ` · <em class="warn-t">toca cortar</em>` : ""}</small></div>
      <div class="end"><b class="${moneyCls(bal)}">${money(Math.abs(bal))}</b><small>${Math.abs(bal) < 0.01 ? "a mano" : bal > 0 ? "te debe" : "le debes"}</small></div></a>`;
  }
  // 6. Próximos cobros
  const up = upcoming(s, C);
  const agenda = up.length ? section("Próximos 14 días", `<div class="card list">${up.slice(0, 8).map((e) => `<a class="row" href="${e.go}">${e.tile}
      <div class="mid"><div class="t1">${esc(e.title)}</div><div class="t2">${esc(e.sub)}</div></div>
      <div class="end"><span class="date-chip ${e.date === today() ? "today" : ""}">${fmtDate(e.date)}</span>${e.amount != null ? `<small class="${e.inc ? "pos" : ""}">${money0(e.amount)}</small>` : ""}</div></a>`).join("")}</div>`) : "";
  // 7. Casa
  let house = "";
  if (p) {
    const hs = houseStats(s, monthKey(today()));
    house = `<a class="card row-card" href="#/casa">${iconTile("house", "accent")}
      <div class="mid"><b>Gastos de casa</b><small>${money0(hs.sum.total)}${hs.budgetTotal ? ` de ${money0(hs.budgetTotal)}` : ""} · tú ${money0(hs.sum.mine)} · ${esc(p.name)} ${money0(hs.sum.theirs)}</small>${hs.budgetTotal ? bar((hs.sum.total / hs.budgetTotal) * 100, hs.sum.total > hs.budgetTotal ? "hot" : "") : ""}</div></a>`;
  }
  const LS = limitsStatus(s, monthKey(today()));
  const limits = LS.rows.length ? section("Límites del mes", `<a class="card lim-list" href="#/limites">${LS.rows.slice(0, 4).map((r) => limitRow(r)).join("")}</a>`, link(`Te quedan ${money0(Math.max(0, LS.totalLimit - LS.totalSpent))}`, "#/limites"))
    : section("Límites del mes", `<button class="card row-card" data-act="editLimits">${iconTile("target", "accent")}<div class="mid"><b>Ponle límite a tu mes</b><small>Súper, restaurantes, gasolina… y te digo cuánto te queda</small></div>${icon("chevron-right", "dim")}</button>`);
  const goals = s.goals.length ? section("Metas", `<div class="card list">${s.goals.slice(0, 3).map((g) => goalRow(g, C)).join("")}</div>`, link("Ver todas", "#/metas")) : "";
  const recent = [...s.tx].sort(sortTx).slice(0, ui.desk ? 10 : 6);
  const recentHtml = section("Últimos movimientos", recent.length
    ? ui.desk ? table(TX_COLS.map((c) => ({ ...c, sort: null })), recent.map((t) => txTableRow(t))) : `<div class="card list">${recent.map((t) => txRow(t)).join("")}</div>`
    : `<p class="muted">Aún no hay movimientos. Toca ＋ para registrar.</p>`, link("Ver todos", "#/movs"));

  const html = ui.desk
    ? `${alerts}<div class="dash"><div>${head}${month}${limits}${partner}${house}</div><div>${agenda || section("Próximos 14 días", `<p class="muted">Nada pendiente.</p>`)}</div></div>${wallet}${goals}${recentHtml}`
    : `${head}${alerts}${wallet}${quick}${month}${limits}${partner}${house}${agenda}${goals}${recentHtml}`;
  return { title: `Hola${s.settings.name ? ", " + s.settings.name : ""}`, html, cls: "home" };
}

// ================= CUENTAS =================
export function accounts(ui) {
  const s = S();
  const C = compute(s);
  const groups = ["debit", "cash", "fund", "savings", "credit"];
  const active = s.accounts.filter((a) => !a.archived);
  const action = `<button class="icon-btn" data-act="newAccount" aria-label="Nueva cuenta">${icon("plus")}</button>`;
  if (!active.length) return { title: "Cuentas", action, html: empty("landmark", "Sin cuentas", "Agrega tus cuentas de débito, tarjetas de crédito, efectivo y fondo común.", `<button class="btn primary" data-act="newAccount">${icon("plus")}<span>Agregar cuenta</span></button>`) };
  const totAssets = active.filter((a) => a.type !== "credit").reduce((x, a) => x + C.acc[a.id], 0);
  const totDebt = active.filter((a) => a.type === "credit").reduce((x, a) => x + Math.max(0, -C.acc[a.id]), 0);
  let html = `<div class="stats2 card"><div><small>Tengo</small><b>${money(totAssets)}</b></div><div><small>Debo en tarjetas</small><b class="neg">${money(totDebt)}</b></div></div>
    <a class="btn primary full big-cta" href="#/cuadrar">${icon("scale")}<span>Cuadrar mis cuentas</span></a>`;
  if (ui.desk) {
    const rows = active.sort((a, b) => groups.indexOf(a.type) - groups.indexOf(b.type)).map((a) => {
      const ci = a.type === "credit" ? cardInfo(s, a, C) : null;
      const stale = !a.lastReconciled || daysBetween(a.lastReconciled, today()) > 7;
      return {
        attrs: `data-go="#/cuenta/${a.id}" class="click"`,
        cells: [
          `<div class="cell-main">${accountTile(a, "xs")}<b>${esc(a.name)}</b></div>`,
          ACCOUNT_TYPES[a.type].label,
          ci ? `<b class="amt ${ci.debt > 0 ? "neg" : ""}">${money(ci.debt)}</b>` : `<b class="amt">${money(C.acc[a.id])}</b>`,
          ci && ci.limit ? `${money0(ci.available)}<div class="mini-bar">${bar(ci.usedPct, ci.usedPct > 70 ? "hot" : "")}</div>` : `<span class="muted">—</span>`,
          ci && ci.msiRemaining ? money(ci.msiRemaining) : `<span class="muted">—</span>`,
          ci?.nextCut ? fmtDate(ci.nextCut, { plain: true }) : `<span class="muted">—</span>`,
          ci?.nextDue ? fmtDate(ci.nextDue, { plain: true }) : `<span class="muted">—</span>`,
          `<span class="${stale ? "warn-t" : "muted"}">${a.lastReconciled ? relDays(a.lastReconciled) : "nunca"}</span>`,
          `<button class="pill" data-act="reconcile" data-id="${a.id}">Cuadrar</button>`,
        ],
      };
    });
    html += table([{ label: "Cuenta" }, { label: "Tipo" }, { label: "Saldo / deuda", cls: "num" }, { label: "Disponible", cls: "num" }, { label: "MSI pendiente", cls: "num" }, { label: "Corte" }, { label: "Pago" }, { label: "Cuadre" }, { label: "" }], rows);
  } else {
    for (const g of groups) {
      const list = active.filter((a) => a.type === g);
      if (!list.length) continue;
      const total = list.reduce((x, a) => x + naturalBalance(a, C.acc[a.id]), 0);
      html += section(ACCOUNT_TYPES[g].plural, `<div class="bcard-grid">${list.map((a) => bankCard(a, C, { compact: true })).join("")}</div>`, `<span class="sec-sum ${g === "credit" ? "neg" : ""}">${money(total)}</span>`);
    }
  }
  const arch = s.accounts.filter((a) => a.archived);
  if (arch.length) html += `<details class="archived"><summary>Archivadas (${arch.length})</summary><div class="card list">${arch.map((a) => accountRow(a, C)).join("")}</div></details>`;
  return { title: "Cuentas", action, html };
}
function accountRow(a, C) {
  const s = S();
  const bal = C.acc[a.id];
  const rec = a.lastReconciled ? `Cuadrada ${relDays(a.lastReconciled)}` : "Sin cuadrar";
  const stale = !a.lastReconciled || daysBetween(a.lastReconciled, today()) > 7;
  if (a.type === "credit") {
    const ci = cardInfo(s, a, C);
    return `<a class="row acct" href="#/cuenta/${a.id}">${accountTile(a)}
      <div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2"><span class="${stale ? "warn-t" : ""}">${rec}</span>${ci.limit ? ` · disp. ${money0(ci.available)}` : ""}</div>${ci.limit ? bar(ci.usedPct, ci.usedPct > 70 ? "hot" : "") : ""}</div>
      <div class="end"><b class="amt ${ci.debt > 0 ? "neg" : "pos"}">${ci.debt > 0 ? money(ci.debt) : ci.credit ? "+" + money(ci.credit) : money(0)}</b>${ci.msiRemaining ? `<small>MSI ${money0(ci.msiRemaining)}</small>` : ""}</div></a>`;
  }
  return `<a class="row acct" href="#/cuenta/${a.id}">${accountTile(a)}
    <div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2 ${stale ? "warn-t" : ""}">${rec}</div></div>
    <div class="end"><b class="amt">${money(bal)}</b></div></a>`;
}

export function reconcileList() {
  const s = S();
  const C = compute(s);
  const active = s.accounts.filter((a) => !a.archived);
  const html = `<p class="lead">Abre la app de tu banco, compara y captura el saldo real. Si no cuadra, se registra un ajuste por la diferencia.</p>
    <div class="card list">${active.map((a) => {
      const nat = naturalBalance(a, C.acc[a.id]);
      const ok = a.lastReconciled && daysBetween(a.lastReconciled, today()) <= 7;
      return `<button class="row" data-act="reconcile" data-id="${a.id}">${accountTile(a)}
        <div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2">${ok ? `<span class="pos">${icon("circle-check")} Cuadrada ${relDays(a.lastReconciled)}</span>` : a.lastReconciled ? `<span class="warn-t">Último cuadre ${fmtDate(a.lastReconciled)}</span>` : `<span class="warn-t">Nunca cuadrada</span>`}</div></div>
        <div class="end"><b class="amt">${money(nat)}</b><small>${a.type === "credit" ? "deuda" : "saldo"}</small></div></button>`;
    }).join("")}</div>`;
  return { title: "Cuadrar", back: true, html };
}

export function accountDetail(id, ui) {
  const s = S();
  const a = st.account(id);
  if (!a) return { title: "Cuenta", back: true, html: empty("circle-plus", "No existe", "Esta cuenta ya no existe.") };
  const C = compute(s);
  const bal = C.acc[a.id];
  let head = "";
  if (a.type === "credit") {
    const ci = cardInfo(s, a, C);
    head = `<div class="hero">
      <div class="hero-top">${accountTile(a, "sm")}<span>Deuda total</span></div>
      <div class="big ${ci.debt > 0 ? "" : "pos"}">${ci.debt > 0 ? money(ci.debt) : money(ci.credit)}</div>
      ${ci.limit ? `${bar(ci.usedPct, ci.usedPct > 70 ? "hot" : "")}<div class="hero-row"><div><small>Disponible</small><b>${money0(ci.available)}</b></div><div><small>Límite</small><b>${money0(ci.limit)}</b></div><div><small>Usado</small><b>${ci.usedPct.toFixed(0)}%</b></div></div>` : ""}
    </div>
    <div class="actions">
      ${btn("Pagar", `data-act="add" data-kind="payment" data-to="${a.id}"`, "primary", "credit-card")}
      ${btn("Cuadrar", `data-act="reconcile" data-id="${a.id}"`, "", "scale")}
      ${btn("Gasto", `data-act="add" data-kind="expense" data-acc="${a.id}"`, "", "receipt")}
      ${btn("MSI", `data-act="add" data-kind="msi" data-acc="${a.id}"`, "", "calendar")}
      ${btn("Bono", `data-act="add" data-kind="bonus" data-acc="${a.id}"`, "", "star")}
    </div>
    <div class="card">
      ${kv(ci.debtNoMsi < 0 ? "A favor sin contar MSI" : "Deuda sin MSI", `<span class="${ci.debtNoMsi < 0 ? "pos" : ""}">${money(Math.abs(ci.debtNoMsi))}</span>`)}
      ${kv("MSI por pagar", money(ci.msiRemaining))}
      ${kv("Mensualidades MSI del mes", money(ci.msiMonthly))}
      ${ci.nextCut ? kv("Próximo corte", `${fmtDate(ci.nextCut)} <small>(${relDays(ci.nextCut)})</small>`) : ""}
      ${ci.nextDue ? kv("Fecha límite de pago", `${fmtDate(ci.nextDue)} <small>(${relDays(ci.nextDue)})</small>`) : ""}
      ${a.lastReconciled ? kv("Último cuadre", fmtDate(a.lastReconciled)) : ""}
    </div>`;
    if (ci.plans.length) head += section("Compras a MSI vigentes", ui.desk ? msiTable(ci.plans, C) : `<div class="card list">${ci.plans.map((m) => msiInfoRow(m, C)).join("")}</div>`);
  } else {
    head = `<div class="hero"><div class="hero-top">${accountTile(a, "sm")}<span>${ACCOUNT_TYPES[a.type].label}</span></div><div class="big">${money(bal)}</div>
      <small class="hero-note">${a.lastReconciled ? `Último cuadre ${fmtDate(a.lastReconciled)}` : `<span class="warn-t">Aún sin cuadrar</span>`}</small></div>
    <div class="actions">
      ${btn("Cuadrar", `data-act="reconcile" data-id="${a.id}"`, "primary", "scale")}
      ${btn("Gasto", `data-act="add" data-kind="expense" data-acc="${a.id}"`, "", "receipt")}
      ${btn("Ingreso", `data-act="add" data-kind="income" data-acc="${a.id}"`, "", "arrow-down-left")}
      ${btn("Transferir", `data-act="add" data-kind="transfer" data-acc="${a.id}"`, "", "arrow-left-right")}
      ${btn("Ajuste", `data-act="add" data-kind="adjust" data-acc="${a.id}"`, "", "sliders-horizontal")}
    </div>`;
  }
  // historial con saldo acumulado (para comparar con el estado de cuenta)
  const entries = [];
  for (const t of s.tx) {
    if (t.hist) continue; // el histórico importado no forma parte del saldo
    const v = txAccountEffects(t).filter(([x]) => x === a.id).reduce((q, [, y]) => q + y, 0);
    if (v || t.accountId === a.id || t.toAccountId === a.id) entries.push({ t, v, date: t.date, createdAt: t.createdAt || 0 });
  }
  for (const m of s.msi) if (m.accountId === a.id && (!a.initialDate || m.date >= a.initialDate)) entries.push({ m, v: -Number(m.total), date: m.date, createdAt: m.createdAt || 0 });
  entries.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.createdAt - y.createdAt));
  let run = Number(a.initial) || 0;
  for (const e of entries) { run += e.v; e.run = run; }
  entries.reverse();
  const shown = entries.slice(0, 200);
  let list;
  if (ui.desk) {
    list = table([...TX_COLS.map((c) => ({ ...c, sort: null })), { label: a.type === "credit" ? "Deuda" : "Saldo", cls: "num" }],
      shown.map((e) => e.t ? txTableRow(e.t, { accountId: a.id, running: naturalBalance(a, e.run) })
        : { attrs: `data-act="msi" data-id="${e.m.id}" class="click"`, cells: [fmtDate(e.m.date, { plain: true }), `<div class="cell-main">${iconTile("calendar", "", "xs")}<b>${esc(e.m.concept)}</b></div>`, "Compra a MSI", esc(a.name), "—", `<b class="amt">−${money(e.m.total)}</b>`, `<span class="muted">${money(naturalBalance(a, e.run))}</span>`] }),
      { foot: `<tr><td colspan="6">Saldo inicial ${a.initialDate ? "· " + fmtDate(a.initialDate, { plain: true }) : ""}</td><td class="num">${money(naturalBalance(a, Number(a.initial) || 0))}</td></tr>` });
  } else {
    list = `<div class="card list">${shown.length ? groupByDate(shown, (e) => (e.t ? txRow(e.t, { accountId: a.id, running: naturalBalance(a, e.run) }) : msiInfoRow(e.m, C))) : `<p class="muted center pad">Sin movimientos.</p>`}
      <div class="row static">${iconTile("flag")}<div class="mid"><div class="t1">Saldo inicial</div><div class="t2">${a.initialDate ? fmtDate(a.initialDate) : ""}</div></div><div class="end"><b class="amt">${money(naturalBalance(a, Number(a.initial) || 0))}</b></div></div></div>`;
  }
  const hist = s.tx.filter((t) => t.hist && (t.accountId === a.id || t.toAccountId === a.id)).sort(sortTx).slice(0, 150);
  const histHtml = hist.length ? section(`Historial del Excel`, (ui.desk ? table(TX_COLS.map((c) => ({ ...c, sort: null })), hist.map((t) => txTableRow(t))) : `<div class="card list">${groupByDate(hist, (t) => txRow(t))}</div>`) + `<p class="fine">Movimientos importados de tu Excel. El saldo de arriba ya está cuadrado con tu hoja Resumen.</p>`) : "";
  return { title: a.name, back: true, action: `<button class="icon-btn" data-act="editAccount" data-id="${a.id}" aria-label="Editar">${icon("pencil")}</button>`, html: head + section("Movimientos", list) + histHtml };
}

// ================= GASTOS DE CASA =================
export function casa(ui) {
  const s = S();
  const p = st.partner();
  const tabs = `<div class="tabs"><a class="on" href="#/casa">Gastos de casa</a><a href="#/fondo">Fondo común</a></div>`;
  if (!p) return { title: "Casa", html: tabs + empty("house", "Configura a tu pareja", "Los gastos de casa se reparten entre tú y tu pareja. Agrégala en Personas y marca “Es mi pareja”.", `<button class="btn primary" data-act="newPerson">${icon("plus")}<span>Agregar pareja</span></button>`) };
  const hs = houseStats(s, ui.month);
  const myPct = Number(s.settings.fund.myPct) || 0;
  const settle = hs.sum.settle;
  let html = tabs + `
    <div class="month-nav card"><button data-act="month" data-d="-1">${icon("chevron-left")}</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">${icon("chevron-right")}</button></div>
    <div class="${ui.desk ? "dash" : ""}"><div>
    <div class="hero">
      <div class="hero-top"><span>Gastos de casa del mes</span></div>
      <div class="big">${money(hs.sum.total)}</div>
      ${hs.budgetTotal ? `${bar((hs.sum.total / hs.budgetTotal) * 100, hs.sum.total > hs.budgetTotal ? "hot" : "")}<small class="hero-note">${money0(hs.budgetTotal - hs.sum.total)} disponibles de ${money0(hs.budgetTotal)}</small>` : ""}
      <div class="hero-row">
        <div><small>Mi parte (${myPct}%)</small><b>${money0(hs.sum.mine)}</b></div>
        <div><small>${esc(p.name)} (${100 - myPct}%)</small><b>${money0(hs.sum.theirs)}</b></div>
      </div>
    </div>
    <div class="card">
      ${kv("Pagué yo", money(hs.sum.me))}
      ${kv(`Pagó ${esc(p.name)}`, money(hs.sum.partner))}
      ${s.settings.fund.accountId ? kv("Del fondo común", money(hs.sum.fund)) : ""}
      <div class="settle ${moneyCls(settle)}">${Math.abs(settle) < 0.01 ? "Por la casa este mes están a mano" : settle > 0 ? `Por la casa, ${esc(p.name)} te debe <b>${money(settle)}</b>` : `Por la casa, le debes a ${esc(p.name)} <b>${money(-settle)}</b>`}<small>Se suma automáticamente a tu corte con ${esc(p.name)}.</small></div>
    </div>
    <div class="actions">
      ${btn("Pagué yo", `data-act="add" data-kind="house"`, "primary", "plus")}
      ${btn(`Pagó ${esc(p.name)}`, `data-act="add" data-kind="house" data-payer="partner"`, "", "users")}
      ${s.settings.fund.accountId ? btn("Del fondo", `data-act="add" data-kind="house" data-payer="fund"`, "", "house") : ""}
    </div></div><div>`;
  html += section("Presupuesto", hs.lines.length ? `<div class="card">${hs.lines.map((l) => {
    const c = catOf(l.categoryId);
    const over = l.amount && l.spent > l.amount;
    return `<div class="budget-row"><div class="bt">${categoryTile(c, "xs")}<span>${esc(l.name || c?.name || "Otros")}${l.extra ? ' <em class="tag">sin presupuesto</em>' : ""}</span><b class="${over ? "neg" : ""}">${money0(l.spent)}${l.amount ? `<small> / ${money0(l.amount)}</small>` : ""}</b></div>${l.amount ? bar((l.spent / l.amount) * 100, over ? "hot" : "") : ""}</div>`;
  }).join("")}</div>` : `<p class="muted">Define cuánto gastan al mes en renta, súper, servicios…</p>`, `<button class="sec-link" data-act="budget">Editar</button>`);
  html += `</div></div>`;
  const payerLbl = { me: "Yo", partner: p.name, fund: "Fondo" };
  if (ui.desk) {
    html += section("Gastos del mes", table(
      [{ label: "Fecha", cls: "w-date" }, { label: "Concepto" }, { label: "Categoría" }, { label: "Pagó" }, { label: "Total", cls: "num" }, { label: "Mi parte", cls: "num" }, { label: esc(p.name), cls: "num" }],
      hs.items.map((x) => {
        const c = catOf(x.t.categoryId);
        return { attrs: `data-act="tx" data-id="${x.t.id}" class="click"`, cells: [fmtDate(x.t.date, { plain: true }), `<div class="cell-main">${txTile(x.t, "xs")}<b>${esc(txTitle(x.t))}</b></div>`, c ? `<span class="cat-chip">${c.ico ? icon(c.ico) : ""}${esc(c.name)}</span>` : "—", `<span class="tag ${x.paidBy}">${esc(payerLbl[x.paidBy])}</span>`, `<b class="amt">${money(x.total)}</b>`, money(x.mine), money(x.theirs)] };
      }),
      { foot: `<tr><td colspan="4">Total</td><td class="num">${money(hs.sum.total)}</td><td class="num">${money(hs.sum.mine)}</td><td class="num">${money(hs.sum.theirs)}</td></tr>` }));
  } else {
    html += section("Gastos del mes", hs.items.length ? `<div class="card list">${groupByDate(hs.items.map((x) => ({ ...x, date: x.t.date })), (x) => `
      <button class="row" data-act="tx" data-id="${x.t.id}">${txTile(x.t)}<div class="mid"><div class="t1">${esc(txTitle(x.t))}</div><div class="t2">Pagó ${esc(payerLbl[x.paidBy])} · tú ${money0(x.mine)} · ${esc(p.name)} ${money0(x.theirs)}</div></div><div class="end"><b class="amt">${money(x.total)}</b></div></button>`)}</div>`
      : `<p class="muted">Sin gastos de casa este mes.</p>`);
  }
  html += `<p class="fine pad">Reparto: tú ${myPct}% · ${esc(p.name)} ${100 - myPct}%. Cámbialo en Ajustes. Lo que paga el fondo ya está repartido por las aportaciones.</p>`;
  return { title: "Casa", html };
}

// ================= PERSONAS =================
export function people(ui) {
  const s = S();
  const C = compute(s);
  const p = st.partner();
  let html = "";
  if (p) {
    const bal = C.ppl[p.id];
    html += `<a class="card partner" href="#/cortes">
      <div class="pc-top"><span class="avatar">${esc(p.name[0] || "?")}</span><div><b>${esc(p.name)}</b><small>Cortes y gastos compartidos</small></div>${icon("chevron-right", "dim")}</div>
      <div class="pc-amt ${moneyCls(bal)}"><small>${Math.abs(bal) < 0.01 ? "Están a mano" : bal > 0 ? "Te debe" : "Le debes"}</small><b>${money(Math.abs(bal))}</b></div></a>`;
  }
  const others = s.people.filter((x) => !x.archived && x.id !== p?.id).sort((a, b) => Math.abs(C.ppl[b.id]) - Math.abs(C.ppl[a.id]));
  html += `<div class="stats2 card"><div><small>Te deben</small><b class="pos">${money(C.owedToMe)}</b></div><div><small>Debes</small><b class="neg">${money(C.iOwe)}</b></div></div>`;
  let list;
  if (!others.length) list = empty("users", "Nadie todavía", "Agrega a tu papá, amigos o a quien le prestes o te preste dinero.", `<button class="btn primary" data-act="newPerson">${icon("plus")}<span>Agregar persona</span></button>`);
  else if (ui.desk) {
    list = table([{ label: "Persona" }, { label: "Relación" }, { label: "Saldo", cls: "num" }, { label: "Estado" }, { label: "Plan de pagos" }, { label: "Siguiente pago" }],
      others.map((x) => {
        const bal = C.ppl[x.id];
        const pi = planInfo(s, x);
        return { attrs: `data-go="#/persona/${x.id}" class="click"`, cells: [`<div class="cell-main"><span class="avatar xs">${esc(x.name[0])}</span><b>${esc(x.name)}</b></div>`, esc(x.relation || ""), `<b class="amt ${moneyCls(bal)}">${money(Math.abs(bal))}</b>`, Math.abs(bal) < 0.01 ? "A mano" : bal > 0 ? "Te debe" : "Le debes",
          pi ? `${money0(pi.amount)} / ${x.plan.freq}${pi.diff < -0.01 ? ` · <span class="warn-t">atrasado ${money0(-pi.diff)}</span>` : ` · <span class="pos">al corriente</span>`}` : `<span class="muted">—</span>`, pi?.next ? fmtDate(pi.next, { plain: true }) : `<span class="muted">—</span>`] };
      }));
  } else list = `<div class="card list">${others.map((x) => personRow(x, C)).join("")}</div>`;
  html += section("Familia y amigos", list, `<button class="sec-link" data-act="add" data-kind="person">${icon("plus")} Movimiento</button>`);
  const arch = s.people.filter((x) => x.archived);
  if (arch.length) html += `<details class="archived"><summary>Archivados (${arch.length})</summary><div class="card list">${arch.map((x) => personRow(x, C)).join("")}</div></details>`;
  if (!p) html += `<p class="fine pad">¿Compartes gastos con tu pareja? Agrégala y marca “Es mi pareja” para usar cortes y gastos de casa.</p>`;
  return { title: "Personas", action: `<button class="icon-btn" data-act="newPerson" aria-label="Nueva persona">${icon("plus")}</button>`, html };
}
function personRow(p, C) {
  const bal = C.ppl[p.id];
  const pi = planInfo(S(), p);
  return `<a class="row" href="#/persona/${p.id}"><span class="avatar sm">${esc(p.name[0] || "?")}</span>
    <div class="mid"><div class="t1">${esc(p.name)}</div><div class="t2">${esc(p.relation || "")}${pi ? ` · ${money0(pi.amount)}/${p.plan.freq}${pi.diff < -0.01 ? ` · <span class="warn-t">atrasado ${money0(-pi.diff)}</span>` : ""}` : ""}</div></div>
    <div class="end"><b class="amt ${moneyCls(bal)}">${money(Math.abs(bal))}</b><small>${Math.abs(bal) < 0.01 ? "a mano" : bal > 0 ? "te debe" : "le debes"}</small></div></a>`;
}

export function personDetail(id, ui) {
  const s = S();
  const p = st.person(id);
  if (!p) return { title: "Persona", back: true, html: empty("users", "No existe", "") };
  const C = compute(s);
  const bal = C.ppl[p.id];
  const pi = planInfo(s, p);
  const ev = personEvents(s, p.id);
  let html = `<div class="hero"><div class="hero-top"><span class="avatar sm">${esc(p.name[0])}</span><span>${Math.abs(bal) < 0.01 ? "Están a mano" : bal > 0 ? `${esc(p.name)} te debe` : `Le debes a ${esc(p.name)}`}</span></div><div class="big ${moneyCls(bal)}">${money(Math.abs(bal))}</div></div>
    <div class="actions">
      ${btn("Me pagó", `data-act="add" data-kind="person" data-person="${p.id}" data-pkind="collect"`, "primary", "arrow-down-left")}
      ${btn("Le presté", `data-act="add" data-kind="person" data-person="${p.id}" data-pkind="lend"`, "", "arrow-up-right")}
      ${btn("Me debe", `data-act="add" data-kind="person" data-person="${p.id}" data-pkind="owesMe"`, "", "plus")}
      ${btn("Le debo", `data-act="add" data-kind="person" data-person="${p.id}" data-pkind="iOwe"`, "", "receipt")}
      ${btn("Le pagué", `data-act="add" data-kind="person" data-person="${p.id}" data-pkind="repay"`, "", "check")}
    </div>`;
  if (pi) {
    html += section("Plan de pagos", `<div class="card">
      ${bar(pi.pct, "done")}
      ${kv("Pago", `${money(pi.amount)} por ${p.plan.freq === "quincenal" ? "quincena" : p.plan.freq === "semanal" ? "semana" : "mes"}`)}
      ${pi.total ? kv("Pagado del plan", `${money(pi.paid)} de ${money(pi.total)}`) : kv("Pagado", money(pi.paid))}
      ${kv("Debería llevar", `${money(pi.expected)} <small>(${pi.periods} pagos)</small>`)}
      ${kv(pi.diff < -0.01 ? "Atrasado" : "Adelantado", `<span class="${pi.diff < -0.01 ? "neg" : "pos"}">${money(Math.abs(pi.diff))}</span>`)}
      ${pi.next ? kv("Siguiente pago", fmtDate(pi.next)) : kv("Estado", "Plan completo")}
      <p class="fine">Al registrar “Me pagó”, marca “abono a su plan”.</p></div>`);
  }
  const title = (e) => (e.tx ? txTitle(e.tx) : `${e.msi.concept} (${e.k}/${e.msi.months})`);
  const attrs = (e) => `data-act="${e.tx ? "tx" : "msi"}" data-id="${e.tx ? e.tx.id : e.msi.id}"`;
  let hist;
  if (ui.desk) {
    hist = table([{ label: "Fecha", cls: "w-date" }, { label: "Concepto" }, { label: "Tipo" }, { label: "Cuenta" }, { label: "Efecto", cls: "num" }],
      ev.map((e) => ({ attrs: attrs(e) + ' class="click"', cells: [fmtDate(e.date, { plain: true }), `<b>${esc(title(e))}</b>`, EVENT_LABEL[e.kind], e.tx?.accountId ? esc(accName(e.tx.accountId)) : "—", `<b class="amt ${moneyCls(e.amount)}">${moneySigned(e.amount)}</b>`] })),
      { foot: p.initial ? `<tr><td colspan="4">Saldo de antes</td><td class="num">${moneySigned(p.initial)}</td></tr>` : "" });
  } else {
    hist = `<div class="card list">${ev.length ? groupByDate(ev, (e) => `<button class="row" ${attrs(e)}>${iconTile(e.amount >= 0 ? "arrow-up-right" : "arrow-down-left", e.amount >= 0 ? "accent" : "")}
      <div class="mid"><div class="t1">${esc(title(e))}</div><div class="t2">${EVENT_LABEL[e.kind]}${e.tx?.accountId ? " · " + esc(accName(e.tx.accountId)) : ""}</div></div>
      <div class="end"><b class="amt ${moneyCls(e.amount)}">${moneySigned(e.amount)}</b></div></button>`) : ""}
      ${p.initial ? `<div class="row static">${iconTile("flag")}<div class="mid"><div class="t1">Saldo de antes</div></div><div class="end"><b class="amt ${moneyCls(p.initial)}">${moneySigned(p.initial)}</b></div></div>` : ""}
      ${!ev.length && !p.initial ? `<p class="muted center pad">Sin movimientos.</p>` : ""}</div>`;
  }
  html += section("Historial", hist + `<p class="fine">+ aumenta lo que te debe · − lo reduce</p>`);
  return { title: p.name, back: true, action: `<button class="icon-btn" data-act="editPerson" data-id="${p.id}" aria-label="Editar">${icon("pencil")}</button>`, html };
}

// ================= CORTES =================
export function cortes(ui) {
  const s = S();
  const p = st.partner();
  if (!p) return { title: "Cortes", back: true, html: empty("users", "Sin pareja configurada", "Agrega a tu pareja en Personas y marca “Es mi pareja”.", `<button class="btn primary" data-act="newPerson">${icon("plus")}<span>Agregar</span></button>`) };
  const start = openCorteStart(s);
  const defEnd = corteDefaultEnd(start, s.settings.corteFreq);
  const end = ui.corteEnd && ui.corteEnd >= start ? ui.corteEnd : defEnd;
  const sum = corteSummary(s, start, end);
  const due = today() > end;
  const c = sum.closing;
  const G = sum.groups;
  const line = (k, label) => (G[k] ? kv(label, `<span class="${moneyCls(G[k])}">${moneySigned(G[k])}</span>`) : "");
  let html = `
    <div class="card corte">
      <div class="corte-dates">
        <div><small>Desde</small><b>${fmtDate(start, { plain: true, weekday: true })}</b></div>
        <span>${icon("arrow-right")}</span>
        <label><small>Hasta</small><input type="date" data-act="corteEnd" value="${end}" min="${start}"/></label>
      </div>
      ${due ? `<p class="banner warn">${icon("triangle-alert")}<span>Ya pasó la fecha de corte. Ciérralo para empezar el siguiente.</span></p>` : ""}
      ${kv("Saldo que venía", `<span class="${moneyCls(sum.opening)}">${moneySigned(sum.opening)}</span>`)}
      ${line("share", "Gastos compartidos (su parte)")}
      ${line("full", `Gastos 100% de ${esc(p.name)}`)}
      ${line("msi", "Mensualidades MSI")}
      ${line("iOwe", `Lo que pagó ${esc(p.name)} (tu parte)`)}
      ${line("owesMe", "Otras deudas")}
      ${line("lend", "Préstamos")}
      ${line("collect", `Pagos de ${esc(p.name)}`)}
      ${line("repay", "Tus pagos")}
      ${line("borrow", "Te prestó")}
      <div class="corte-total ${moneyCls(c)}"><small>${Math.abs(c) < 0.01 ? "Están a mano" : c > 0 ? `${esc(p.name)} te debe` : `Le debes a ${esc(p.name)}`}</small><b>${money(Math.abs(c))}</b></div>
      <div class="actions">
        ${btn("Cerrar corte", `data-act="closeCorte" data-start="${start}" data-end="${end}"`, "primary", "scissors")}
        ${btn("Gasto compartido", `data-act="add" data-kind="expense" data-split="partner"`, "", "plus")}
        ${btn(`${esc(p.name)} pagó`, `data-act="add" data-kind="partnerPaid"`, "", "users")}
      </div>
    </div>`;
  const title = (e) => (e.tx ? txTitle(e.tx) : `${e.msi.concept} (${e.k}/${e.msi.months})`);
  const attrs = (e) => `data-act="${e.tx ? "tx" : "msi"}" data-id="${e.tx ? e.tx.id : e.msi.id}"`;
  const items = [...sum.items].reverse();
  let list;
  if (!items.length) list = `<p class="muted">Nada en este corte todavía.</p>`;
  else if (ui.desk) {
    list = table([{ label: "Fecha", cls: "w-date" }, { label: "Concepto" }, { label: "Tipo" }, { label: "Total", cls: "num" }, { label: "Efecto", cls: "num" }],
      items.map((e) => ({ attrs: attrs(e) + ' class="click"', cells: [fmtDate(e.date, { plain: true }), `<div class="cell-main">${e.tx ? txTile(e.tx, "xs") : iconTile("calendar", "", "xs")}<b>${esc(title(e))}</b></div>`, EVENT_LABEL[e.kind], e.tx?.type === "expense" ? money(e.tx.amount) : e.tx?.total ? money(e.tx.total) : "—", `<b class="amt ${moneyCls(e.amount)}">${moneySigned(e.amount)}</b>`] })),
      { foot: `<tr><td colspan="4">Saldo del corte (incluye ${moneySigned(sum.opening)} que venía)</td><td class="num">${moneySigned(c)}</td></tr>` });
  } else {
    list = `<div class="card list">${items.map((e) => `<button class="row" ${attrs(e)}>${e.tx ? txTile(e.tx) : iconTile("calendar")}
      <div class="mid"><div class="t1">${esc(title(e))}</div><div class="t2">${fmtDate(e.date)} · ${EVENT_LABEL[e.kind]}${e.tx?.type === "expense" ? ` · total ${money0(e.tx.amount)}` : e.tx?.total ? ` · total ${money0(e.tx.total)}` : ""}</div></div>
      <div class="end"><b class="amt ${moneyCls(e.amount)}">${moneySigned(e.amount)}</b></div></button>`).join("")}</div>`;
  }
  html += section("Movimientos del corte", list);
  const hist = [...s.cortes].sort((a, b) => (a.end < b.end ? 1 : -1));
  if (hist.length) {
    html += section("Cortes anteriores", `<div class="card list">${hist.map((k, i) => `
      <div class="row static">${iconTile("scissors")}<div class="mid"><div class="t1">${fmtRange(k.start, k.end)}</div>
        <div class="t2">${k.closing > 0 ? `${esc(p.name)} debía` : k.closing < 0 ? "Le debías" : "A mano"} ${money(Math.abs(k.closing))}${k.paid ? ` · pagado ${money(Math.abs(k.paid))}` : ""}${k.note ? " · " + esc(k.note) : ""}</div></div>
        ${i === 0 ? `<button class="pill" data-act="reopenCorte" data-id="${k.id}">Reabrir</button>` : ""}</div>`).join("")}</div>`);
  }
  html += `<p class="fine pad">Cortes ${s.settings.corteFreq === "weekly" ? "semanales" : s.settings.corteFreq === "biweekly" ? "cada 2 semanas" : "mensuales"} · ${esc(p.name)} paga ${s.settings.partnerPct}% de lo compartido. Puedes mover la fecha “Hasta”.</p>`;
  return { title: `Cortes con ${p.name}`, back: true, html };
}

// ================= MÁS =================
export function more() {
  const s = S();
  const items = [
    ["#/personas", "users", "Personas y deudas", `${s.people.filter((p) => !p.archived).length} personas`, APPLE.blue],
    ["#/cortes", "scissors", "Cortes con tu pareja", st.partner()?.name || "Sin configurar", APPLE.pink],
    ["#/movs", "list", "Movimientos", `${s.tx.length} registrados`, APPLE.gray],
    ["#/analisis", "sliders-horizontal", "Análisis y promedios", "Cuánto gastas en promedio", APPLE.indigo],
    ["#/suscripciones", "repeat", "Suscripciones", `${(s.subs || []).filter((x) => x.active).length} activas`, APPLE.red],
    ["#/fondo", "house-plus", "Fondo común", s.settings.fund.accountId ? accName(s.settings.fund.accountId) : "Sin configurar", APPLE.brown],
    ["#/limites", "gauge", "Límites del mes", `${Object.values(s.settings.limits || {}).filter((v) => v > 0).length} categorías`, APPLE.orange],
    ["#/metas", "target", "Metas de ahorro", `${s.goals.length} metas`, APPLE.green],
    ["#/msi", "calendar", "Meses sin intereses", `${s.msi.filter((m) => !msiInfo(m).done).length} vigentes`, APPLE.orange],
    ["#/cuadrar", "scale", "Cuadrar cuentas", "", APPLE.teal],
    ["#/categorias", "tag", "Categorías", "", APPLE.purple],
    ["#/respaldo", "download", "Respaldo", s.settings.lastBackup ? `último ${fmtDate(s.settings.lastBackup)}` : "nunca", APPLE.cyan],
    ["#/ajustes", "settings", "Ajustes", "", APPLE.gray],
  ];
  return { title: "Más", html: `<div class="card list">${items.map(([h, i, t, sub, col]) => `<a class="row" href="${h}">${colorTile(i, col, "sm")}<div class="mid"><div class="t1">${t}</div>${sub ? `<div class="t2">${esc(sub)}</div>` : ""}</div>${icon("chevron-right", "dim")}</a>`).join("")}</div>
    <p class="fine pad center">Cuadra · tus datos viven en este dispositivo</p>` };
}

// ================= MOVIMIENTOS =================
function inlineAddRow() {
  const s = S();
  const p = st.partner();
  const accs = s.accounts.filter((a) => !a.archived);
  const cats = categoriesByUse(s, "expense");
  const last = s.settings.lastAccountId;
  return `<tr class="inline-add" id="inlineAdd">
    <td><input type="date" name="ia_date" value="${today()}"/></td>
    <td><input name="ia_concept" placeholder="Nuevo gasto: concepto"/></td>
    <td><select name="ia_cat"><option value="">Categoría</option>${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></td>
    <td><select name="ia_acc">${accs.map((a) => `<option value="${a.id}" ${a.id === last ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></td>
    <td><select name="ia_split"><option value="none">Solo yo</option>${p ? `<option value="partner">Con ${esc(p.name)} ${s.settings.partnerPct}%</option><option value="half">50/50</option><option value="partner100">100% ${esc(p.name)}</option><option value="house">Casa ${s.settings.fund.myPct}/${100 - s.settings.fund.myPct}</option>` : ""}</select></td>
    <td class="num"><div class="ia-amt"><input name="ia_amount" inputmode="decimal" placeholder="0.00"/><button class="btn primary sm" data-act="inlineAdd">${icon("plus")}</button></div></td>
  </tr>`;
}
export function movements(ui) {
  const s = S();
  const C = compute(s);
  const f = ui.movFilter;
  const q = (f.q || "").toLowerCase();
  let list = s.tx.filter((t) => (f.all ? true : monthKey(t.date) === ui.month));
  if (f.type) list = list.filter((t) => (f.type === "people" ? ["lend", "collect", "borrow", "repay", "debt"].includes(t.type) : f.type === "house" ? isHouse(s, t) : t.type === f.type));
  if (f.account) list = list.filter((t) => t.accountId === f.account || t.toAccountId === f.account);
  if (f.cat) list = list.filter((t) => t.categoryId === f.cat);
  if (q) list = list.filter((t) => `${txTitle(t)} ${txSub(t)} ${t.note || ""}`.toLowerCase().includes(q) || String(t.amount).includes(q));
  const msis = !f.type || f.type === "msi" ? s.msi.filter((m) => (f.all || monthKey(m.date) === ui.month) && (!f.account || m.accountId === f.account) && (!f.cat || m.categoryId === f.cat) && (!q || (m.concept || "").toLowerCase().includes(q))) : [];
  if (f.type === "msi") list = [];
  const typeOpts = [["", "Todo"], ["expense", "Gastos"], ["income", "Ingresos"], ["house", "Casa"], ["transfer", "Pagos / transf."], ["people", "Personas"], ["msi", "MSI"], ["adjust", "Ajustes"]];
  const filters = `
    <div class="filters">
      <label class="search">${icon("search")}<input type="search" placeholder="Buscar concepto, monto…" value="${esc(f.q || "")}" data-filter="q"/></label>
      <select data-filter="type">${typeOpts.map(([v, l]) => `<option value="${v}" ${f.type === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-filter="account"><option value="">Todas las cuentas</option>${s.accounts.map((a) => `<option value="${a.id}" ${f.account === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
      ${ui.desk ? `<select data-filter="cat"><option value="">Todas las categorías</option>${s.categories.map((c) => `<option value="${c.id}" ${f.cat === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>` : ""}
    </div>
    <div class="month-nav card">${f.all ? `<b>Todos los meses</b>` : `<button data-act="month" data-d="-1">${icon("chevron-left")}</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">${icon("chevron-right")}</button>`}<button class="pill" data-act="toggleAll">${f.all ? "Por mes" : "Ver todo"}</button></div>`;
  // resumen y gráfica simple del filtro actual
  const sumExp = list.filter((t) => t.type === "expense" && !t.excluded).reduce((q, t) => q + Number(t.amount), 0);
  const sumMine = list.filter((t) => t.type === "expense" && !t.excluded).reduce((q, t) => q + Number(t.amount) - (t.shares || []).reduce((z, x) => z + Number(x.amount || 0), 0), 0);
  const sumInc = list.filter((t) => t.type === "income").reduce((q, t) => q + Number(t.amount), 0);
  const byCat = {};
  for (const t of list) if (t.type === "expense" && !t.excluded) byCat[t.categoryId || "_"] = (byCat[t.categoryId || "_"] || 0) + Number(t.amount);
  const topC = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxC = topC[0]?.[1] || 1;
  const catChip = f.cat ? `<button class="pill filter-chip" data-act="filterCat" data-id="${f.cat}">${esc(catOf(f.cat)?.name || "Categoría")} ${icon("x")}</button>` : "";
  const summary = catChip + `<div class="mov-sum card">
      <div class="stats3"><div><small>Gastos</small><b>${money0(sumExp)}</b></div><div><small>Tu parte</small><b>${money0(sumMine)}</b></div><div><small>Ingresos</small><b class="pos">${money0(sumInc)}</b></div></div>
      ${topC.length ? `<div class="hbars">${topC.map(([id, v]) => { const c = catOf(id); return `<button class="hbar" data-act="filterCat" data-id="${id}">${categoryTile(c, "xs")}<span>${esc(c?.name || "Sin categoría")}</span><i><em style="width:${((v / maxC) * 100).toFixed(1)}%"></em></i><b>${money0(v)}</b></button>`; }).join("")}</div>` : ""}
    </div>`;
  const viewSw = ui.desk ? "" : `<div class="tabs view-sw"><a href="#/movs" data-act="movView" data-v="list" class="${ui.movView !== "table" ? "on" : ""}">${icon("layout-list")} Lista</a><a href="#/movs" data-act="movView" data-v="table" class="${ui.movView === "table" ? "on" : ""}">${icon("table")} Tabla</a></div>`;
  let html = filters + summary + viewSw;
  if (ui.desk || ui.movView === "table") {
    const sort = ui.sort || { key: "date", dir: -1 };
    const rows = [...list.map((t) => ({ t, date: t.date, amt: Math.abs(Number(t.amount)), c: t.createdAt || 0 })), ...msis.map((m) => ({ m, date: m.date, amt: Number(m.total), c: m.createdAt || 0 }))];
    rows.sort((a, b) => sort.key === "amount" ? (a.amt - b.amt) * sort.dir : (a.date < b.date ? -1 : a.date > b.date ? 1 : a.c - b.c) * sort.dir);
    const spend = list.reduce((x, t) => x + (t.type === "expense" ? Number(t.amount) : 0), 0);
    const inc = list.reduce((x, t) => x + (t.type === "income" ? Number(t.amount) : 0), 0);
    html += table(TX_COLS, rows.slice(0, 1000).map((r) => r.t ? txTableRow(r.t) : { attrs: `data-act="msi" data-id="${r.m.id}" class="click"`, cells: [fmtDate(r.m.date, { plain: true }), `<div class="cell-main">${iconTile("calendar", "", "xs")}<b>${esc(r.m.concept)}</b></div>`, "Compra a MSI", esc(accName(r.m.accountId)), (r.m.shares || []).map((x) => `<span class="tag">${esc(pName(x.personId))} ${x.pct}%</span>`).join("") || "—", `<b class="amt muted">${money(r.m.total)}</b>`] }),
      { sort, head: ui.desk ? inlineAddRow() : "", foot: `<tr><td colspan="5">${rows.length} movimientos · gastos ${money(spend)} · ingresos ${money(inc)}</td><td class="num"></td></tr>` });
  } else {
    const merged = [...list.map((t) => ({ t, date: t.date, c: t.createdAt || 0 })), ...msis.map((m) => ({ m, date: m.date, c: m.createdAt || 0 }))].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.c - a.c));
    const shown = merged.slice(0, 400);
    html += shown.length ? `<div class="card list">${groupByDate(shown, (x) => (x.t ? txRow(x.t) : msiInfoRow(x.m, C)))}</div>` : `<p class="muted center pad">Sin movimientos.</p>`;
  }
  return { title: "Movimientos", back: !ui.desk, action: ui.desk ? `<button class="btn ghost sm" data-act="exportCsv">${icon("file-spreadsheet")}<span>Exportar CSV</span></button>` : "", html };
}

// ================= FONDO COMÚN =================
export function fund(ui) {
  const s = S();
  const C = compute(s);
  const f = s.settings.fund;
  const p = st.partner();
  const tabs = p ? `<div class="tabs"><a href="#/casa">Gastos de casa</a><a class="on" href="#/fondo">Fondo común</a></div>` : "";
  if (!f.accountId || !st.account(f.accountId)) {
    const opts = s.accounts.filter((a) => a.type !== "credit" && !a.archived);
    return { title: "Fondo común", html: tabs + empty("house-plus", "Configura tu fondo común", `Es una cuenta tuya a donde tú${p ? " y " + esc(p.name) : ""} aportan cada mes, y de ahí se pagan renta, súper y servicios.`,
      `<button class="btn primary" data-act="newFundAccount">${icon("plus")}<span>Crear cuenta “Fondo común”</span></button>
       ${opts.length ? `<div class="field"><span class="lbl">o usa una cuenta existente</span><select data-act="pickFund"><option value="">Elegir…</option>${opts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></div>` : ""}`) };
  }
  const fs = fundStats(s, ui.month, C);
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  let html = tabs + `
    <div class="month-nav card"><button data-act="month" data-d="-1">${icon("chevron-left")}</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">${icon("chevron-right")}</button></div>
    <div class="hero"><div class="hero-top">${accountTile(st.account(f.accountId), "sm")}<span>Saldo del fondo</span></div><div class="big">${money(fs.balance)}</div></div>
    <div class="actions">
      ${btn("Yo aporto", `data-act="add" data-kind="fundIn"`, "primary", "plus")}
      ${p ? btn(`Aporta ${esc(p.name)}`, `data-act="add" data-kind="fundPartner"`, "", "users") : ""}
      ${btn("Pagar algo de la casa", `data-act="add" data-kind="fundExpense"`, "", "receipt")}
    </div>`;
  html += section("Aportaciones del mes", `<div class="card">
    <div class="contrib"><span>Yo (${fs.myPct}%)</span>${bar(pct(fs.contribMe, fs.expectedMe), fs.contribMe >= fs.expectedMe && fs.expectedMe ? "done" : "")}<b>${money0(fs.contribMe)} / ${money0(fs.expectedMe)}</b></div>
    ${p ? `<div class="contrib"><span>${esc(p.name)} (${100 - fs.myPct}%)</span>${bar(pct(fs.contribPartner, fs.expectedPartner), fs.contribPartner >= fs.expectedPartner && fs.expectedPartner ? "done" : "")}<b>${money0(fs.contribPartner)} / ${money0(fs.expectedPartner)}</b></div>` : ""}
    ${fs.contribOther ? kv("Otros", money(fs.contribOther)) : ""}
    ${p && fs.expectedPartner - fs.contribPartner > 0.01 ? `<p class="fine">A ${esc(p.name)} le faltan ${money(fs.expectedPartner - fs.contribPartner)} este mes.</p>` : ""}
    ${fs.expectedMe - fs.contribMe > 0.01 ? `<p class="fine">A ti te faltan ${money(fs.expectedMe - fs.contribMe)}.</p>` : ""}
  </div>`, `<button class="sec-link" data-act="budget">Presupuesto</button>`);
  html += section("Movimientos del fondo", fs.items.length ? (ui.desk ? table(TX_COLS.map((c) => ({ ...c, sort: null })), fs.items.map((t) => txTableRow(t, { accountId: f.accountId }))) : `<div class="card list">${groupByDate(fs.items, (t) => txRow(t, { accountId: f.accountId }))}</div>`) : `<p class="muted">Sin movimientos este mes.</p>`);
  return { title: "Fondo común", html };
}

// ================= METAS =================
function goalRow(g, C) {
  const gp = goalProgress(S(), g, C);
  return `<a class="row" href="#/meta/${g.id}"><span class="tile emoji">${esc(g.icon || "🌱")}</span>
    <div class="mid"><div class="t1">${esc(g.name)}</div><div class="t2">${money0(gp.current)} de ${money0(gp.target)}${gp.perMonth ? ` · ${money0(gp.perMonth)}/mes` : ""}</div>${bar(gp.pct, gp.done ? "done" : "")}</div>
    <div class="end"><b class="amt">${gp.pct.toFixed(0)}%</b></div></a>`;
}
export function goals() {
  const s = S();
  const C = compute(s);
  const html = s.goals.length ? `<div class="card list">${s.goals.map((g) => goalRow(g, C)).join("")}</div>` :
    empty("target", "Sin metas", "Crea metas: vivir en otro lugar, la boda, un fondo de emergencia…", `<button class="btn primary" data-act="newGoal">${icon("plus")}<span>Nueva meta</span></button>`);
  return { title: "Metas de ahorro", back: true, action: `<button class="icon-btn" data-act="newGoal" aria-label="Nueva meta">${icon("plus")}</button>`, html };
}
export function goalDetail(id) {
  const s = S();
  const g = s.goals.find((x) => x.id === id);
  if (!g) return { title: "Meta", back: true, html: empty("target", "No existe", "") };
  const C = compute(s);
  const gp = goalProgress(s, g, C);
  const mode = { manual: "Aportaciones que registras", account: `Saldo de ${accName(g.accountId)}`, networth: "Tu patrimonio neto" }[g.mode];
  let html = `<div class="hero"><div class="hero-top"><span class="tile emoji sm">${esc(g.icon || "🌱")}</span><span>${esc(g.name)}</span></div><div class="big">${money(gp.current)}</div>${bar(gp.pct, gp.done ? "done" : "")}<small class="hero-note">${gp.pct.toFixed(1)}% de ${money(gp.target)}</small></div>
    <div class="card">
      ${kv("Se mide con", esc(mode))}
      ${kv("Falta", money(gp.remaining))}
      ${g.deadline ? kv("Fecha objetivo", fmtDate(g.deadline, { year: true })) : ""}
      ${gp.perMonth ? kv("Necesitas por mes", money(gp.perMonth)) : ""}
      ${g.mode === "manual" ? kv("Aportado este mes", money(gp.thisMonth)) : ""}
    </div>`;
  if (g.mode === "manual") {
    const cs = [...g.contributions].sort((a, b) => (a.date < b.date ? 1 : -1));
    html += `<div class="actions">${btn("Aportar", `data-act="contrib" data-id="${g.id}"`, "primary", "plus")}</div>`;
    html += section("Aportaciones", cs.length ? `<div class="card list">${cs.map((c) => `<button class="row" data-act="contrib" data-id="${g.id}" data-cid="${c.id}">${iconTile(c.amount >= 0 ? "piggy-bank" : "undo-2", c.amount >= 0 ? "accent" : "")}<div class="mid"><div class="t1">${esc(c.note || (c.amount >= 0 ? "Aportación" : "Retiro"))}</div><div class="t2">${fmtDate(c.date)}</div></div><div class="end"><b class="amt ${moneyCls(c.amount)}">${moneySigned(c.amount)}</b></div></button>`).join("")}</div>` : `<p class="muted">Aún sin aportaciones.</p>`);
  }
  return { title: g.name, back: true, action: `<button class="icon-btn" data-act="editGoal" data-id="${g.id}" aria-label="Editar">${icon("pencil")}</button>`, html };
}

// ================= MSI =================
function msiTable(list, C) {
  return table([{ label: "Concepto" }, { label: "Tarjeta" }, { label: "A cargo de" }, { label: "Mensualidad", cls: "num" }, { label: "Pagadas" }, { label: "Restante", cls: "num" }, { label: "Siguiente" }],
    list.map((m) => {
      const i = C.msi[m.id];
      return { attrs: `data-act="msi" data-id="${m.id}" class="click"`, cells: [`<div class="cell-main">${brandFor(m.concept) ? logo(brandFor(m.concept), "xs") : categoryTile(catOf(m.categoryId), "xs")}<b>${esc(m.concept)}</b></div>`, esc(accName(m.accountId)),
        (m.shares || []).map((x) => `<span class="tag">${esc(pName(x.personId))} ${x.pct}%</span>`).join("") || "Yo", money(i.monthly), `${i.paid}/${i.months}<div class="mini-bar">${bar((i.paid / i.months) * 100)}</div>`, `<b class="amt">${money(i.remaining)}</b>`, i.nextDate ? fmtDate(i.nextDate, { plain: true }) : "—"] };
    }));
}
export function msiList(ui) {
  const s = S();
  const C = compute(s);
  const active = s.msi.filter((m) => !C.msi[m.id].done);
  const doneL = s.msi.filter((m) => C.msi[m.id].done);
  const totRem = active.reduce((x, m) => x + C.msi[m.id].remaining, 0);
  const totMon = active.reduce((x, m) => x + C.msi[m.id].monthly, 0);
  let html = `<div class="stats2 card"><div><small>Por pagar</small><b>${money(totRem)}</b></div><div><small>Mensualidades</small><b>${money(totMon)}</b></div></div>
    <p class="fine pad">El mes en que vas se calcula solo con la fecha de la primera mensualidad.</p>`;
  if (!active.length) html += empty("calendar", "Sin MSI vigentes", "Registra tus compras a meses y la app lleva la cuenta de cada mensualidad.", `<button class="btn primary" data-act="add" data-kind="msi">${icon("plus")}<span>Compra a MSI</span></button>`);
  else if (ui.desk) html += msiTable(active, C);
  else for (const id of [...new Set(active.map((m) => m.accountId))]) html += section(accName(id), `<div class="card list">${active.filter((m) => m.accountId === id).map((m) => msiInfoRow(m, C)).join("")}</div>`);
  if (doneL.length) html += `<details class="archived"><summary>Liquidadas (${doneL.length})</summary><div class="card list">${doneL.map((m) => msiInfoRow(m, C)).join("")}</div></details>`;
  return { title: "Meses sin intereses", back: !ui.desk, action: `<button class="icon-btn" data-act="add" data-kind="msi" aria-label="Nueva">${icon("plus")}</button>`, html };
}

// ================= CATEGORÍAS =================
export function categories() {
  const s = S();
  const row = (c) => `<button class="row" data-act="editCat" data-id="${c.id}">${categoryTile(c)}<div class="mid"><div class="t1">${esc(c.name)}</div>${c.kind === "income" && c.real === false ? `<div class="t2">no cuenta como ingreso</div>` : ""}</div>${icon("chevron-right", "dim")}</button>`;
  const html = section("Gastos", `<div class="card list">${s.categories.filter((c) => c.kind === "expense").map(row).join("")}</div>`, `<button class="sec-link" data-act="newCat" data-kind="expense">${icon("plus")} Nueva</button>`) +
    section("Ingresos", `<div class="card list">${s.categories.filter((c) => c.kind === "income").map(row).join("")}</div>`, `<button class="sec-link" data-act="newCat" data-kind="income">${icon("plus")} Nueva</button>`);
  return { title: "Categorías", back: true, html };
}

// ================= RESPALDO =================
export function backup() {
  const s = S();
  const html = `
    <div class="card">
      <p class="lead">Tus datos se guardan <b>solo en este dispositivo</b>. Exporta un respaldo seguido y guárdalo en Archivos / iCloud Drive.</p>
      ${kv("Último respaldo", s.settings.lastBackup ? fmtDate(s.settings.lastBackup, { year: true }) : "Nunca")}
      ${kv("Movimientos", String(s.tx.length))}
      <div class="actions col">
        ${btn("Exportar respaldo (.json)", `data-act="export"`, "primary", "download")}
        ${btn("Exportar movimientos a Excel (.csv)", `data-act="exportCsv"`, "", "file-spreadsheet")}
        <label class="btn">${icon("upload")}<span>Importar respaldo</span><input type="file" accept=".json,application/json" data-act="import" hidden/></label>
      </div>
    </div>
    ${section("Zona de peligro", `<div class="card"><button class="btn danger full" data-act="wipe">${icon("trash-2")}<span>Borrar todos los datos</span></button></div>`)}`;
  return { title: "Respaldo", back: true, html };
}

// ================= AJUSTES =================
export function settings() {
  const s = S();
  const st2 = s.settings;
  const ppl = s.people.filter((p) => !p.archived);
  const html = `
    <div class="card form">
      <label class="field"><span class="lbl">Apariencia</span><select data-setting="theme">${[["dark", "Oscura (recomendada)"], ["auto", "Automática (como tu iPhone)"], ["light", "Clara"]].map(([v, l]) => `<option value="${v}" ${(st2.theme || "dark") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">Patrimonio y "Debo"</span><select data-setting="nwExcludeMsi"><option value="1" ${st2.nwExcludeMsi !== false ? "selected" : ""}>Sin restar los MSI (como en tu Excel)</option><option value="0" ${st2.nwExcludeMsi === false ? "selected" : ""}>Restando toda la deuda, MSI incluidos</option></select></label>
      <label class="field"><span class="lbl">Color principal</span><select data-setting="palette">${[["jade", "Jade"], ["esmeralda", "Esmeralda"], ["salvia", "Salvia"], ["bosque", "Bosque"], ["olivo", "Olivo"]].map(([v, l]) => `<option value="${v}" ${(st2.palette || "jade") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">Tu nombre</span><input data-setting="name" value="${esc(st2.name)}" placeholder="Fer"/></label>
      <label class="field"><span class="lbl">Tu pareja</span><select data-setting="partnerId"><option value="">— Ninguna —</option>${ppl.map((p) => `<option value="${p.id}" ${st2.partnerId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">% que paga tu pareja en gastos compartidos</span><input data-setting="partnerPct" inputmode="decimal" value="${st2.partnerPct}"/></label>
      <label class="field"><span class="lbl">Mi % en gastos de casa y fondo común</span><input data-setting="fundPct" inputmode="decimal" value="${st2.fund.myPct}"/><small class="hint">Ej. 60 = tú pagas 60% y tu pareja 40%.</small></label>
      <label class="field"><span class="lbl">Frecuencia de cortes</span><select data-setting="corteFreq">
        ${[["weekly", "Cada semana"], ["biweekly", "Cada 2 semanas"], ["monthly", "Cada mes"]].map(([v, l]) => `<option value="${v}" ${st2.corteFreq === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${!s.cortes.length ? `<label class="field"><span class="lbl">Inicio del primer corte</span><input type="date" data-setting="corteStart" value="${st2.corteStart || ""}"/><small class="hint">Hoy es ${DIAS_L[new Date().getDay()]}.</small></label>` : ""}
    </div>
    <p class="fine pad">Los cambios se guardan solos.</p>
    ${section("Recordatorios", `<div class="card"><p class="lead" style="margin:0 0 12px">Agrega a tu Calendario del iPhone avisos para pagar tarjetas, cerrar el corte con tu pareja, la renta, suscripciones y los pagos de tu papá. El iPhone te notifica solo.</p>
      ${btn("Agregar recordatorios al Calendario", `data-act="exportIcs"`, "primary full", "calendar")}</div>`)}
    ${section("Compras con Apple Pay", `<div class="card">
      <p class="lead" style="margin:0 0 10px">Con la app <b>Atajos</b> del iPhone, cada vez que pagas acercando el teléfono se puede mandar la compra a Cuadra.</p>
      ${kv("Link para el Atajo", `<code class="mono">${esc(location.origin + location.pathname)}#/nuevo?monto=…&comercio=…&tarjeta=…</code>`)}
      ${kv("Buzón (cuando la tengas en Hostinger)", st2.inboxUrl ? `<span class="pos">conectado</span>` : `<span class="muted">sin conectar</span>`)}
      <label class="field" style="margin-top:10px"><span class="lbl">URL del buzón (opcional)</span><input data-setting="inboxUrl" value="${esc(st2.inboxUrl || "")}" placeholder="https://tudominio.com/fer/inbox.php"/></label>
      ${kv("Clave del buzón", `<code class="mono">${esc(st2.inboxToken || "")}</code>`)}
      <a class="btn full" href="#/applepay">${icon("info")}<span>Cómo configurar el Atajo</span></a></div>`)}`;
  return { title: "Ajustes", back: true, html };
}

// ================= ANÁLISIS =================
export function analysisView(ui) {
  const s = S();
  const n = ui.anMonths || 6;
  const noExtra = ui.anExtra !== false;
  const A = analysis(s, n, brandFor, { noExtra });
  const p = st.partner();
  const per = `<div class="tabs">${[3, 6, 12].map((k) => `<a href="#/analisis" data-act="anMonths" data-n="${k}" class="${n === k ? "on" : ""}">${k} meses</a>`).join("")}</div>
    <button class="toggle-row" data-act="anExtra"><span>Sin gastos extraordinarios <small>(viajes grandes, boda, reparaciones)</small></span><span class="sw-mini ${noExtra ? "on" : ""}"></span></button>`;
  if (!A.count) return { title: "Análisis", back: !ui.desk, html: per + empty("sliders-horizontal", "Sin datos suficientes", "Registra gastos o importa tu historial para ver promedios.") };
  const curM = A.byMonth[A.cur];
  const maxM = Math.max(...[...A.months, A.cur].map((m) => A.byMonth[m].spend), 1);
  const chart = `<div class="mchart">${[...A.months, A.cur].map((m) => {
    const x = A.byMonth[m];
    return `<div class="mcol ${m === A.cur ? "cur" : ""}" title="${fmtMonth(m)}: ${money0(x.spend)}"><div class="mbar"><i style="height:${((x.spend / maxM) * 100).toFixed(1)}%"></i><i class="mine" style="height:${((x.mine / maxM) * 100).toFixed(1)}%"></i></div><small>${fmtMonth(m).slice(0, 3)}</small></div>`;
  }).join("")}</div><p class="fine">Barra completa = gasto total · parte oscura = tu parte. El último mes (en curso) va aparte.</p>`;
  let html = per + `
    <div class="${ui.desk ? "dash" : ""}"><div>
    <div class="hero">
      <div class="hero-top"><span>Gasto promedio mensual · últimos ${n} meses${noExtra ? " · sin extraordinarios" : ""}</span></div>
      <div class="big">${money0(A.avg)}</div>
      <div class="hero-row">
        <div><small>Mi parte</small><b>${money0(A.avgMine)}</b></div>
        <div><small>${p ? esc(p.name) + " y otros" : "Otros"}</small><b>${money0(A.avgOthers)}</b></div>
        <div><small>Ingreso por trabajo</small><b class="pos">${money0(A.avgWork)}</b></div>
      </div>
    </div>
    <div class="card">
      ${kv("Ingreso promedio por trabajo", money(A.avgWork))}
      ${kv("Ingreso mediano por mes", `${money(A.medianWork)} <small>(la mitad de los meses ganas menos que esto)</small>`)}
      ${kv("Lo que te queda (trabajo − tu parte)", `<span class="${moneyCls(A.saving)}">${money(A.saving)}</span> <small>al mes</small>`)}
      ${kv("Este mes vas", `${money0(curM.spend)} <small>de ${money0(A.avg)} promedio</small>`)}
      ${A.bonusIn ? kv("Bonos de tarjeta (neto)", `<span class="pos">${money0(A.avgBonusNet)}</span> <small>al mes · recibiste ${money0(A.bonusIn)}, compartiste ${money0(A.bonusOut)}</small>`) : ""}
      ${noExtra && A.extras ? kv("Extraordinarios (aparte)", `${money0(A.avgExtras)} <small>al mes · ${money0(A.extras)} en ${n} meses</small>`) : ""}
    </div></div><div>
    ${section("Mes a mes", `<div class="card">${chart}</div>`)}
    </div></div>`;
  // tarjetas de estadísticas (estilo app Salud)
  const statCats = A.cats.filter((c) => c.id !== "_" && c.id !== "c_otros").slice(0, 8);
  const statTile = (ico, color, label, value, sub) => `<div class="stat">${colorTile(ico, color, "xs")}<small>${label}</small><b>${value}</b><span>${sub}</span></div>`;
  html += section("Promedios al mes", `<div class="stats-grid">
    ${statTile("arrow-down-left", APPLE.green, "Ingreso por trabajo", money0(A.avgWork), `mediana ${money0(A.medianWork)}`)}
    ${statTile("receipt", APPLE.orange, "Gasto total", money0(A.avg), `tu parte ${money0(A.avgMine)}`)}
    ${statCats.map((c) => { const cat = catOf(c.id); return statTile(cat?.ico || "package", CAT_COLOR[c.id] || APPLE.gray, esc(cat?.name || "Otros"), money0(c.avg), `tu parte ${money0(c.mine / n)}`); }).join("")}
  </div>`);
  const top = A.merchants.slice(0, ui.desk ? 40 : 15);
  const tileFor = (m) => (brandFor(m.name) ? logo(brandFor(m.name), "xs") : m.sample?.categoryId ? categoryTile(catOf(m.sample.categoryId), "xs") : iconTile("receipt", "", "xs"));
  html += section("¿En qué se va? · por comercio", ui.desk
    ? table([{ label: "Comercio / concepto" }, { label: "Promedio al mes", cls: "num" }, { label: "Total", cls: "num" }, { label: "Veces" }, { label: "Meses" }, { label: "Ticket promedio", cls: "num" }, { label: "Mi parte", cls: "num" }, { label: "Tarjeta más usada" }],
      top.map((m) => ({ cells: [`<div class="cell-main">${tileFor(m)}<b>${esc(m.name)}</b></div>`, `<b class="amt">${money0(m.avg)}</b>`, money0(m.total), String(m.n), `${m.months}/${n}`, money0(m.ticket), money0(m.mine), m.card ? esc(accName(m.card)) : "—"] })))
    : `<div class="card list">${top.map((m) => `<div class="row static">${tileFor(m).replace("xs", "")}<div class="mid"><div class="t1">${esc(m.name)}</div><div class="t2">${m.n} veces · ${m.months} de ${n} meses · ticket ${money0(m.ticket)}${m.card ? " · " + esc(accName(m.card)) : ""}</div></div><div class="end"><b class="amt">${money0(m.avg)}</b><small>al mes</small></div></div>`).join("")}</div>`);
  const maxC = A.cats[0]?.avg || 1;
  html += `<div class="${ui.desk ? "dash" : ""}">` + section("Por categoría", `<div class="card">${A.cats.map((c) => {
    const cat = catOf(c.id);
    return `<div class="cat-row">${categoryTile(cat, "xs")}<span>${cat ? esc(cat.name) : "Sin categoría"}</span><b>${money0(c.avg)}<small class="muted"> /mes</small></b>${bar((c.avg / maxC) * 100)}</div>`;
  }).join("")}</div>`) + section("Por tarjeta", `<div class="card list">${A.cards.map((c) => { const a = st.account(c.id); return a ? `<a class="row" href="#/cuenta/${a.id}">${accountTile(a)}<div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2">${money0(c.total)} en ${n} meses</div></div><div class="end"><b class="amt">${money0(c.avg)}</b><small>al mes</small></div></a>` : ""; }).join("")}</div>`) + `</div>`;
  html += `<p class="fine pad">No cuenta pagos a tarjetas, retiros ni préstamos. Las mensualidades MSI cuentan en el mes que se cobran. Incluye el historial importado del Excel.</p>`;
  return { title: "Análisis", back: !ui.desk, html };
}

// ================= SUSCRIPCIONES =================
const SUB_STATUS = {
  ok: ["circle-check", "pos", "Cobro al día"],
  missing: ["triangle-alert", "warn-t", "No se ha visto el cobro — ¿cancelada o cambió de nombre?"],
  card: ["credit-card", "warn-t", "Se cobró en otra tarjeta"],
  amount: ["info", "warn-t", "El último cobro fue de otro monto"],
  off: ["x", "muted", "Inactiva"],
};
export function subsView(ui) {
  const s = S();
  const list = [...(s.subs || [])].sort((a, b) => (b.active - a.active) || (!!a.business - !!b.business) || subMonthly(b) - subMonthly(a));
  const act = list.filter((x) => x.active && !x.business);
  const biz = list.filter((x) => x.active && x.business);
  const total = act.reduce((q, x) => q + subMonthly(x), 0);
  const byCard = {};
  for (const x of act) byCard[x.accountId || "_"] = (byCard[x.accountId || "_"] || 0) + subMonthly(x);
  const action = `<button class="icon-btn" data-act="newSub" aria-label="Nueva">${icon("plus")}</button>`;
  if (!list.length) return { title: "Suscripciones", back: !ui.desk, action, html: empty("repeat", "Sin suscripciones", "Agrega Netflix, iCloud, Spotify… y asígnale a cada una la tarjeta donde se cobra.", `<button class="btn primary" data-act="newSub">${icon("plus")}<span>Agregar</span></button>`) };
  let html = `<div class="hero"><div class="hero-top"><span>Suscripciones activas</span></div><div class="big">${money(total)}<small class="muted" style="font-size:15px;font-weight:500"> /mes</small></div>
    <small class="hero-note">${money0(total * 12)} al año · ${act.length} activas${biz.length ? ` · aparte ${money0(biz.reduce((q, x) => q + subMonthly(x), 0))}/mes que paga Ad Center` : ""}</small>
    <div class="hero-row">${Object.entries(byCard).map(([id, v]) => `<div><small>${id === "_" ? "Sin tarjeta" : esc(accName(id))}</small><b>${money0(v)}</b></div>`).join("")}</div></div>`;
  const rows = list.map((x) => ({ x, i: subInfo(s, x, brandFor) }));
  const tile = (x) => (brandFor(x.name) ? logo(brandFor(x.name), ui.desk ? "xs" : "") : iconTile("repeat", "", ui.desk ? "xs" : ""));
  if (ui.desk) {
    html += table([{ label: "Suscripción" }, { label: "Monto", cls: "num" }, { label: "Al mes", cls: "num" }, { label: "Tarjeta asignada" }, { label: "Siguiente cobro" }, { label: "Último cobro visto" }, { label: "Estado" }],
      rows.map(({ x, i }) => ({ attrs: `data-act="editSub" data-id="${x.id}" class="click"`, cells: [
        `<div class="cell-main">${tile(x)}<div><b>${esc(x.name)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div></div>`, `${money(x.amount)} <small class="muted">${x.freq === "anual" ? "/año" : "/mes"}</small>`, money(i.monthly),
        x.accountId ? `<div class="cell-main">${st.account(x.accountId) ? accountTile(st.account(x.accountId), "xs") : ""}${esc(accName(x.accountId))}</div>` : `<span class="warn-t">Sin asignar</span>`,
        x.active && i.next ? fmtDate(i.next, { plain: true }) : "—",
        i.last ? `${fmtDate(i.last.date, { plain: true })} · ${money(i.last.amount)} · ${esc(accName(i.last.accountId))}` : `<span class="muted">nunca</span>`,
        `<span class="${SUB_STATUS[i.status][1]} nowrap">${icon(SUB_STATUS[i.status][0])} ${SUB_STATUS[i.status][2].split(" — ")[0]}</span>`] })));
  } else {
    html += `<div class="card list">${rows.map(({ x, i }) => `<button class="row" data-act="editSub" data-id="${x.id}">${tile(x)}
      <div class="mid"><div class="t1">${esc(x.name)}</div><div class="t2">${x.accountId ? esc(accName(x.accountId)) : '<span class="warn-t">sin tarjeta</span>'}${x.active && i.next ? ` · cobro ${fmtDate(i.next)}` : ""}</div>
      <div class="t2 ${SUB_STATUS[i.status][1]}">${icon(SUB_STATUS[i.status][0], "inline")} ${SUB_STATUS[i.status][2]}${i.last && i.status !== "ok" && i.status !== "off" ? ` (${fmtDate(i.last.date)}, ${money0(i.last.amount)}, ${esc(accName(i.last.accountId))})` : ""}</div></div>
      <div class="end"><b class="amt ${x.active ? "" : "muted"}">${money(x.amount)}</b><small>${x.freq === "anual" ? "al año" : "al mes"}</small></div></button>`).join("")}</div>`;
  }
  html += `<p class="fine pad">La app busca el cobro real en tus movimientos (por nombre o logo) para avisarte si dejó de cobrarse, si llegó a otra tarjeta o si cambió el monto.</p>`;
  return { title: "Suscripciones", back: !ui.desk, action, html };
}

// ================= LÍMITES DEL MES =================
const LIM_CLS = { ok: "", warn: "warnbar", over: "hot" };
export function limitRow(r, desk = false) {
  const cat = catOf(r.id);
  const msg = r.status === "over" ? `<span class="neg">Te pasaste ${money0(-r.remaining)}</span>` : `Te quedan <b>${money0(r.remaining)}</b>`;
  return `<div class="lim-row ${r.status}">
    <div class="lr-top">${categoryTile(cat, "sm")}<div class="lr-name"><b>${esc(cat?.name || "Categoría")}</b><small>${money0(r.spent)} de ${money0(r.limit)}</small></div><div class="lr-left">${msg}</div></div>
    <div class="lim-bar ${LIM_CLS[r.status]}"><i style="width:${Math.min(100, r.pct).toFixed(1)}%"></i>${r.pct > 100 ? "" : ""}</div>
    ${r.status === "warn" && r.pace > 1.15 ? `<small class="lr-note">Vas más rápido que el mes: a este ritmo cierras en ${money0(r.projected)}</small>` : ""}
  </div>`;
}
export function limitsView(ui) {
  const s = S();
  const L = limitsStatus(s, ui.month);
  const action = `<button class="icon-btn" data-act="editLimits" aria-label="Editar límites">${icon("pencil")}</button>`;
  const nav = `<div class="month-nav card"><button data-act="month" data-d="-1">${icon("chevron-left")}</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">${icon("chevron-right")}</button></div>`;
  if (!L.rows.length) return { title: "Límites", back: !ui.desk, action, html: nav + empty("target", "Ponle límite a tu mes", "Define cuánto quieres gastar como máximo en súper, restaurantes, gasolina… y la app te dice cuánto te queda.", `<button class="btn primary" data-act="editLimits">${icon("plus")}<span>Definir límites</span></button>`) };
  const pct = L.totalLimit ? (L.totalSpent / L.totalLimit) * 100 : 0;
  const left = L.totalLimit - L.totalSpent;
  let html = nav + `<div class="hero lim-hero">
      <div class="hero-top"><span>${left >= 0 ? "Te queda para el mes" : "Te pasaste este mes"}</span></div>
      <div class="big ${left < 0 ? "neg" : ""}">${money0(Math.abs(left))}</div>
      <div class="lim-bar big ${pct > 100 ? "hot" : pct > 85 ? "warnbar" : ""}"><i style="width:${Math.min(100, pct).toFixed(1)}%"></i><span class="pace-mark" style="left:${(L.frac * 100).toFixed(1)}%"></span></div>
      <div class="hero-row">
        <div><small>Gastado</small><b>${money0(L.totalSpent)}</b></div>
        <div><small>Límite</small><b>${money0(L.totalLimit)}</b></div>
        ${L.daysLeft ? `<div><small>Por día (${L.daysLeft} días)</small><b>${money0(L.perDay)}</b></div>` : ""}
      </div>
    </div>`;
  if (ui.desk) {
    html += table([{ label: "Categoría" }, { label: "Límite", cls: "num" }, { label: "Gastado", cls: "num" }, { label: "Avance" }, { label: "Te queda", cls: "num" }, { label: "Proyección al cierre", cls: "num" }],
      L.rows.map((r) => { const c = catOf(r.id); return { attrs: `data-act="editLimits" class="click"`, cells: [`<div class="cell-main">${categoryTile(c, "xs")}<b>${esc(c?.name || "")}</b></div>`, money0(r.limit), money0(r.spent), `<div class="lim-bar ${LIM_CLS[r.status]} tblbar"><i style="width:${Math.min(100, r.pct).toFixed(1)}%"></i></div> <small class="muted">${r.pct.toFixed(0)}%</small>`, `<b class="amt ${r.remaining < 0 ? "neg" : ""}">${money0(r.remaining)}</b>`, `<span class="${r.projected > r.limit ? "neg" : "muted"}">${money0(r.projected)}</span>`] }; }),
      { foot: `<tr><td>Total</td><td class="num">${money0(L.totalLimit)}</td><td class="num">${money0(L.totalSpent)}</td><td></td><td class="num">${money0(left)}</td><td></td></tr>` });
  } else {
    html += `<div class="card lim-list">${L.rows.map((r) => limitRow(r)).join("")}</div>`;
  }
  if (L.unlimited > 0) html += `<p class="fine pad">Además gastaste ${money0(L.unlimited)} en categorías sin límite.</p>`;
  html += `<p class="fine pad">Cuenta tu parte de cada gasto (lo que pagó tu pareja por su lado no se suma) y tus mensualidades MSI. La rayita marca en qué día del mes vas.</p>`;
  return { title: "Límites", back: !ui.desk, action, html };
}

// ================= GUÍA APPLE PAY =================
export function applePayGuide() {
  const s = S();
  const base = location.origin + location.pathname;
  const html = `<div class="card guide">
    <p class="lead">Así haces que <b>cada compra con Apple Pay</b> llegue a Cuadra (iOS 17 o más nuevo):</p>
    <ol>
      <li>Abre <b>Atajos</b> → pestaña <b>Automatización</b> → <b>＋</b> → <b>Transacción</b>.</li>
      <li>Elige tus tarjetas de Wallet, marca <b>"Ejecutar inmediatamente"</b> y toca <b>Siguiente</b> → <b>Nuevo atajo en blanco</b>.</li>
      <li>Agrega la acción <b>URL</b> y escribe:<br/><code class="mono">${esc(base)}#/nuevo?monto=</code> + variable <b>Cantidad</b> + <code class="mono">&comercio=</code> + variable <b>Comercio</b> + <code class="mono">&tarjeta=</code> + variable <b>Tarjeta</b>.</li>
      <li>Agrega la acción <b>Abrir URL</b>.</li>
    </ol>
    <p class="fine">Al pagar, se abre Cuadra con el monto, el comercio y la tarjeta ya llenos: solo eliges categoría y guardas. Si el comercio ya lo usaste antes, la categoría también se llena sola.</p>
    <p class="fine"><b>Ojo:</b> en iPhone, “Abrir URL” abre Safari, no el ícono de la pantalla de inicio, y cada uno guarda sus datos aparte. Por eso, hasta tener el buzón, usa Cuadra desde Safari (en Favoritos). Cuando la subas a Hostinger, el buzón (<code class="mono">inbox.php</code>) guarda las compras y la app las recoge sola al abrirse, sin importar desde dónde la abras.</p>
  </div>
  ${section("Con buzón (Hostinger)", `<div class="card guide"><ol>
      <li>Sube el .zip a Hostinger (incluye <code class="mono">inbox.php</code>).</li>
      <li>En Ajustes pega la URL del buzón, por ejemplo <code class="mono">https://tudominio.com/fer/inbox.php</code>.</li>
      <li>En el Atajo, en lugar de “Abrir URL”, usa <b>Obtener contenido de URL</b> → método <b>POST</b> → JSON con <code class="mono">token</code> = <code class="mono">${esc(s.settings.inboxToken || "")}</code>, <code class="mono">monto</code>, <code class="mono">comercio</code> y <code class="mono">tarjeta</code>.</li>
    </ol><p class="fine">Así no se abre nada al pagar: la próxima vez que entres a Cuadra verás “Compras de Apple Pay por registrar”.</p></div>`)}`;
  return { title: "Apple Pay", back: true, html };
}
