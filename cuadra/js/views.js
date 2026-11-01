// ================= Vistas (pantallas) =================
import * as st from "./store.js";
import { ACCOUNT_TYPES } from "./store.js";
import { esc, money, money0, moneySigned, fmtDate, fmtMonth, fmtRange, relDays, today, daysBetween, monthKey, addDays, DIAS_L } from "./format.js";
import { bar, kv, moneyCls } from "./ui.js";
import {
  compute, cardInfo, msiInfo, personEvents, planInfo, monthStats, corteSummary, openCorteStart, corteDefaultEnd,
  fundStats, goalProgress, naturalBalance, txAccountEffects, EVENT_LABEL,
} from "./calc.js";

const S = () => st.state();
const catOf = (id) => st.category(id);
const accName = (id) => st.account(id)?.name || "—";
const pName = (id) => st.person(id)?.name || "—";
const empty = (icon, title, text, btn = "") => `<div class="empty"><i>${icon}</i><h4>${esc(title)}</h4><p>${text}</p>${btn}</div>`;
const section = (title, inner, action = "") => `<section class="sec"><div class="sec-h"><h3>${esc(title)}</h3>${action}</div>${inner}</section>`;
const link = (label, go) => `<a class="sec-link" href="${go}">${esc(label)}</a>`;

// ---------- Fila de movimiento ----------
const TYPE_ICON = { expense: "💸", income: "💰", transfer: "🔁", adjust: "⚖️", lend: "🤝", collect: "🤝", borrow: "🤝", repay: "🤝", debt: "🧾" };
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
  if (c && t.type !== "transfer") bits.push(`${c.icon} ${c.name}`);
  if (t.type === "lend") bits.push(`Le prestaste a ${pName(t.personId)}`);
  if (t.type === "collect") bits.push(`${pName(t.personId)} te pagó`);
  if (t.type === "borrow") bits.push(`${pName(t.personId)} te prestó`);
  if (t.type === "repay") bits.push(`Le pagaste a ${pName(t.personId)}`);
  if (t.type === "debt") bits.push(t.dir === "iOwe" ? `Le debes a ${pName(t.personId)}` : `${pName(t.personId)} te debe`);
  if (t.type === "income" && t.personId) bits.push(`de ${pName(t.personId)}`);
  if (t.reconcile) bits.push("cuadre");
  return bits.join(" · ");
}
function txAmount(t, accountId) {
  if (accountId) {
    const v = txAccountEffects(t).filter(([id]) => id === accountId).reduce((s, [, x]) => s + x, 0);
    return `<b class="amt ${moneyCls(v)}">${moneySigned(v)}</b>`;
  }
  const a = Number(t.amount);
  switch (t.type) {
    case "expense": case "lend": case "repay": return `<b class="amt">−${money(a)}</b>`;
    case "income": case "collect": case "borrow": return `<b class="amt pos">+${money(a)}</b>`;
    case "adjust": return `<b class="amt ${moneyCls(a)}">${moneySigned(a)}</b>`;
    case "debt": return `<b class="amt muted">${money(a)}</b>`;
    default: return `<b class="amt muted">${money(a)}</b>`;
  }
}
export function txRow(t, { accountId, running } = {}) {
  const share = (t.shares || []).filter((x) => x.amount).map((x) => `<span class="tag">${esc(pName(x.personId))} ${money0(x.amount)}</span>`).join("");
  const icon = catOf(t.categoryId)?.icon || TYPE_ICON[t.type] || "•";
  return `<button class="row tx" data-act="tx" data-id="${t.id}">
    <i class="ico">${icon}</i>
    <div class="mid"><div class="t1">${esc(txTitle(t))}</div><div class="t2">${esc(txSub(t))}${share}</div></div>
    <div class="end">${txAmount(t, accountId)}${running != null ? `<small>${money(running)}</small>` : ""}</div>
  </button>`;
}
function msiRow(m, C) {
  const i = C.msi[m.id];
  const who = (m.shares || []).map((x) => `<span class="tag">${esc(pName(x.personId))} ${x.pct}%</span>`).join("");
  return `<button class="row" data-act="msi" data-id="${m.id}">
    <i class="ico">🗓️</i>
    <div class="mid"><div class="t1">${esc(m.concept || "Compra a MSI")}</div>
      <div class="t2">${esc(accName(m.accountId))} · ${i.paid}/${i.months} · ${money(i.monthly)}/mes${who}</div>
      ${bar((i.paid / i.months) * 100, i.done ? "done" : "")}</div>
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
export function home(ui) {
  const s = S();
  const C = compute(s);
  if (!s.accounts.length) {
    return { title: "Cuadra", html: empty("🌿", `Hola${s.settings.name ? ", " + esc(s.settings.name) : ""}`, "Empieza agregando tus cuentas: débito, tarjetas de crédito, efectivo y tu fondo común.", `<button class="btn primary" data-act="newAccount">＋ Agregar cuenta</button><a class="btn ghost" href="#/respaldo">Importar respaldo</a>`) };
  }
  const active = s.accounts.filter((a) => !a.archived);
  const assets = active.filter((a) => a.type !== "credit").reduce((x, a) => x + C.acc[a.id], 0);
  const cardDebt = active.filter((a) => a.type === "credit").reduce((x, a) => x + Math.max(0, -C.acc[a.id]), 0);
  const stale = active.filter((a) => !a.lastReconciled || daysBetween(a.lastReconciled, today()) > 7);
  const backupOld = s.tx.length > 5 && (!s.settings.lastBackup || daysBetween(s.settings.lastBackup, today()) > 7);
  let html = `
    <div class="hero">
      <small>Patrimonio neto</small>
      <div class="big ${moneyCls(C.netWorth)}">${money(C.netWorth)}</div>
      <div class="hero-row">
        <a href="#/cuentas"><small>Tengo</small><b>${money0(assets)}</b></a>
        <a href="#/cuentas"><small>Debo en tarjetas</small><b class="neg">${money0(cardDebt)}</b></a>
        <a href="#/personas"><small>Me deben</small><b class="pos">${money0(C.owedToMe)}</b></a>
      </div>
    </div>`;
  if (backupOld) html += `<a class="banner warn" href="#/respaldo">💾 Haz un respaldo — ${s.settings.lastBackup ? `el último fue ${relDays(s.settings.lastBackup)}` : "aún no tienes ninguno"}</a>`;
  if (stale.length) html += `<a class="banner" href="#/cuadrar">⚖️ ${stale.length === 1 ? `Cuadra ${esc(stale[0].name)}` : `${stale.length} cuentas sin cuadrar esta semana`} <span>Cuadrar →</span></a>`;

  // pareja / corte
  const p = st.partner();
  if (p) {
    const start = openCorteStart(s);
    const end = corteDefaultEnd(start, s.settings.corteFreq);
    const sum = corteSummary(s, start, today() > end ? end : today());
    const bal = C.ppl[p.id];
    const due = today() > end;
    html += `<a class="card partner" href="#/cortes">
      <div class="pc-top"><span class="avatar">${esc(p.name[0] || "?")}</span><div><b>Corte con ${esc(p.name)}</b><small>${fmtRange(start, end)}${due ? ` · <em class="warn-t">¡toca cortar!</em>` : ""}</small></div></div>
      <div class="pc-amt ${moneyCls(bal)}"><small>${Math.abs(bal) < 0.01 ? "Están a mano" : bal > 0 ? `${esc(p.name)} te debe` : `Le debes a ${esc(p.name)}`}</small><b>${money(Math.abs(bal))}</b></div>
      <div class="pc-foot">Este corte: ${moneySigned(sum.change)} · ${sum.items.length} movimientos</div>
    </a>`;
  }

  // mes
  const ms = monthStats(s, ui.month);
  const top = ms.cats.slice(0, 6);
  const maxC = top[0]?.amount || 1;
  html += section(`Mi mes`, `
    <div class="card">
      <div class="month-nav"><button data-act="month" data-d="-1">‹</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">›</button></div>
      <div class="stats3">
        <div><small>Gasté (mi parte)</small><b>${money0(ms.spend)}</b></div>
        <div><small>Ingresos</small><b class="pos">${money0(ms.income)}</b></div>
        <div><small>Balance</small><b class="${moneyCls(ms.net)}">${money0(ms.net)}</b></div>
      </div>
      ${top.length ? `<div class="cats">${top.map((c) => {
        const cat = catOf(c.id);
        return `<div class="cat-row"><span>${cat ? cat.icon + " " + esc(cat.name) : "Sin categoría"}</span><b>${money0(c.amount)}</b>${bar((c.amount / maxC) * 100)}</div>`;
      }).join("")}</div>` : `<p class="muted center">Sin gastos este mes.</p>`}
      <p class="fine">No cuenta pagos a tarjetas ni lo que te deben otros. Incluye tus mensualidades MSI (${money0(ms.msiMine)}).</p>
    </div>`);

  // tarjetas próximas
  const soon = active.filter((a) => a.type === "credit").map((a) => ({ a, ci: cardInfo(s, a, C) }))
    .filter(({ ci }) => (ci.nextDue && daysBetween(today(), ci.nextDue) <= 10 && ci.debt > 0) || (ci.nextCut && daysBetween(today(), ci.nextCut) <= 5))
    .sort((x, y) => (x.ci.nextDue || "9") < (y.ci.nextDue || "9") ? -1 : 1);
  if (soon.length) html += section("Tarjetas: cortes y pagos", `<div class="card list">${soon.map(({ a, ci }) => `
      <a class="row" href="#/cuenta/${a.id}"><i class="ico">💳</i><div class="mid"><div class="t1">${esc(a.name)}</div>
      <div class="t2">${ci.nextCut ? `Corte ${relDays(ci.nextCut)}` : ""}${ci.nextDue ? ` · Pago ${fmtDate(ci.nextDue)} (${relDays(ci.nextDue)})` : ""}</div></div>
      <div class="end"><b class="amt neg">${money(ci.debt)}</b></div></a>`).join("")}</div>`);

  // fondo
  if (s.settings.fund.accountId && st.account(s.settings.fund.accountId)) {
    const fs = fundStats(s, monthKey(today()), C);
    html += section("Fondo común", `<a class="card" href="#/fondo">
      <div class="kv"><span>Saldo del fondo</span><b>${money(fs.balance)}</b></div>
      ${fs.budgetTotal ? `<div class="contrib"><span>Yo</span>${bar(fs.expectedMe ? (fs.contribMe / fs.expectedMe) * 100 : 0)}<b>${money0(fs.contribMe)} / ${money0(fs.expectedMe)}</b></div>
      ${p ? `<div class="contrib"><span>${esc(p.name)}</span>${bar(fs.expectedPartner ? (fs.contribPartner / fs.expectedPartner) * 100 : 0)}<b>${money0(fs.contribPartner)} / ${money0(fs.expectedPartner)}</b></div>` : ""}` : `<p class="muted">Define el presupuesto de la casa →</p>`}
    </a>`);
  }

  // metas
  if (s.goals.length) {
    html += section("Metas de ahorro", `<div class="card list">${s.goals.slice(0, 3).map((g) => goalRow(g, C)).join("")}</div>`, link("Ver todas", "#/metas"));
  }

  // recientes
  const recent = [...s.tx].sort(sortTx).slice(0, 8);
  html += section("Últimos movimientos", recent.length ? `<div class="card list">${recent.map((t) => txRow(t)).join("")}</div>` : `<p class="muted">Aún no hay movimientos. Toca ＋ para registrar.</p>`, link("Ver todos", "#/movs"));
  return { title: `Hola${s.settings.name ? ", " + s.settings.name : ""}`, html };
}

// ================= CUENTAS =================
export function accounts() {
  const s = S();
  const C = compute(s);
  const groups = ["debit", "cash", "fund", "savings", "credit"];
  let html = "";
  const active = s.accounts.filter((a) => !a.archived);
  if (!active.length) html = empty("🏦", "Sin cuentas", "Agrega tus cuentas de débito, tarjetas de crédito, efectivo y fondo común.", `<button class="btn primary" data-act="newAccount">＋ Agregar cuenta</button>`);
  for (const g of groups) {
    const list = active.filter((a) => a.type === g);
    if (!list.length) continue;
    const total = list.reduce((x, a) => x + naturalBalance(a, C.acc[a.id]), 0);
    html += section(ACCOUNT_TYPES[g].plural, `<div class="card list">${list.map((a) => accountRow(a, C)).join("")}</div>`, `<span class="sec-sum ${g === "credit" ? "neg" : ""}">${money(total)}</span>`);
  }
  const arch = s.accounts.filter((a) => a.archived);
  if (arch.length) html += `<details class="archived"><summary>Archivadas (${arch.length})</summary><div class="card list">${arch.map((a) => accountRow(a, C)).join("")}</div></details>`;
  if (active.length) html = `<a class="btn primary full big-cta" href="#/cuadrar">⚖️ Cuadrar mis cuentas</a>` + html;
  return { title: "Cuentas", action: `<button class="icon-btn" data-act="newAccount" aria-label="Nueva cuenta">＋</button>`, html };
}
function accountRow(a, C) {
  const s = S();
  const bal = C.acc[a.id];
  const rec = a.lastReconciled ? `cuadrada ${relDays(a.lastReconciled)}` : "sin cuadrar";
  const stale = !a.lastReconciled || daysBetween(a.lastReconciled, today()) > 7;
  if (a.type === "credit") {
    const ci = cardInfo(s, a, C);
    return `<a class="row acct" href="#/cuenta/${a.id}"><i class="ico">💳</i>
      <div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2"><span class="${stale ? "warn-t" : ""}">${rec}</span>${ci.limit ? ` · disp. ${money0(ci.available)}` : ""}</div>${ci.limit ? bar(ci.usedPct, ci.usedPct > 70 ? "hot" : "") : ""}</div>
      <div class="end"><b class="amt ${ci.debt > 0 ? "neg" : "pos"}">${ci.debt > 0 ? money(ci.debt) : ci.credit ? "+" + money(ci.credit) : money(0)}</b>${ci.msiRemaining ? `<small>MSI ${money0(ci.msiRemaining)}</small>` : ""}</div></a>`;
  }
  return `<a class="row acct" href="#/cuenta/${a.id}"><i class="ico">${ACCOUNT_TYPES[a.type].icon}</i>
    <div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2 ${stale ? "warn-t" : ""}">${rec}</div></div>
    <div class="end"><b class="amt ${moneyCls(bal)}">${money(bal)}</b></div></a>`;
}

export function reconcileList() {
  const s = S();
  const C = compute(s);
  const active = s.accounts.filter((a) => !a.archived);
  const html = `<p class="muted pad">Abre la app de tu banco, compara y captura el saldo real de cada cuenta. Si no cuadra, la app registra un ajuste por la diferencia.</p>
    <div class="card list">${active.map((a) => {
      const nat = naturalBalance(a, C.acc[a.id]);
      const ok = a.lastReconciled && daysBetween(a.lastReconciled, today()) <= 7;
      return `<button class="row" data-act="reconcile" data-id="${a.id}"><i class="ico">${ok ? "✅" : "⚖️"}</i>
        <div class="mid"><div class="t1">${esc(a.name)}</div><div class="t2">${a.lastReconciled ? `Último cuadre ${fmtDate(a.lastReconciled)}` : "Nunca cuadrada"}</div></div>
        <div class="end"><b class="amt">${money(nat)}</b><small>${a.type === "credit" ? "deuda" : "saldo"}</small></div></button>`;
    }).join("")}</div>`;
  return { title: "Cuadrar", back: true, html };
}

export function accountDetail(id) {
  const s = S();
  const a = st.account(id);
  if (!a) return { title: "Cuenta", back: true, html: empty("❓", "No existe", "Esta cuenta ya no existe.") };
  const C = compute(s);
  const bal = C.acc[a.id];
  let head = "";
  if (a.type === "credit") {
    const ci = cardInfo(s, a, C);
    head = `<div class="hero small">
      <small>Deuda total</small><div class="big ${ci.debt > 0 ? "neg" : "pos"}">${ci.debt > 0 ? money(ci.debt) : money(ci.credit)}</div>
      ${ci.limit ? `${bar(ci.usedPct, ci.usedPct > 70 ? "hot" : "")}<div class="hero-row"><div><small>Disponible</small><b>${money0(ci.available)}</b></div><div><small>Límite</small><b>${money0(ci.limit)}</b></div></div>` : ""}
    </div>
    <div class="card">
      ${kv("Deuda sin MSI", money(ci.debtNoMsi))}
      ${kv("MSI por pagar", money(ci.msiRemaining))}
      ${kv("Mensualidades MSI este mes", money(ci.msiMonthly))}
      ${ci.nextCut ? kv("Próximo corte", `${fmtDate(ci.nextCut)} <small>(${relDays(ci.nextCut)})</small>`) : ""}
      ${ci.nextDue ? kv("Fecha límite de pago", `${fmtDate(ci.nextDue)} <small>(${relDays(ci.nextDue)})</small>`) : ""}
      ${a.lastReconciled ? kv("Último cuadre", fmtDate(a.lastReconciled)) : ""}
    </div>
    <div class="actions">
      <button class="btn primary" data-act="add" data-kind="payment" data-to="${a.id}">💳 Pagar</button>
      <button class="btn" data-act="reconcile" data-id="${a.id}">⚖️ Cuadrar</button>
      <button class="btn" data-act="add" data-kind="expense" data-acc="${a.id}">💸 Gasto</button>
      <button class="btn" data-act="add" data-kind="msi" data-acc="${a.id}">🗓️ MSI</button>
      <button class="btn" data-act="add" data-kind="bonus" data-acc="${a.id}">⭐ Bono</button>
    </div>`;
    if (ci.plans.length) head += section("Compras a MSI vigentes", `<div class="card list">${ci.plans.map((m) => msiRow(m, C)).join("")}</div>`);
  } else {
    head = `<div class="hero small"><small>${ACCOUNT_TYPES[a.type].label}</small><div class="big ${moneyCls(bal)}">${money(bal)}</div>
      ${a.lastReconciled ? `<small>Último cuadre ${fmtDate(a.lastReconciled)}</small>` : `<small class="warn-t">Aún sin cuadrar</small>`}</div>
    <div class="actions">
      <button class="btn primary" data-act="reconcile" data-id="${a.id}">⚖️ Cuadrar</button>
      <button class="btn" data-act="add" data-kind="expense" data-acc="${a.id}">💸 Gasto</button>
      <button class="btn" data-act="add" data-kind="income" data-acc="${a.id}">💰 Ingreso</button>
      <button class="btn" data-act="add" data-kind="transfer" data-acc="${a.id}">🔁 Transferir</button>
      <button class="btn" data-act="add" data-kind="adjust" data-acc="${a.id}">⚖️ Ajuste</button>
    </div>`;
  }
  // historial con saldo acumulado (útil para comparar con el estado de cuenta)
  const entries = [];
  for (const t of s.tx) {
    const v = txAccountEffects(t).filter(([x]) => x === a.id).reduce((q, [, y]) => q + y, 0);
    if (v || t.accountId === a.id || t.toAccountId === a.id) entries.push({ t, v, date: t.date, createdAt: t.createdAt || 0 });
  }
  for (const m of s.msi) if (m.accountId === a.id && (!a.initialDate || m.date >= a.initialDate)) entries.push({ m, v: -Number(m.total), date: m.date, createdAt: m.createdAt || 0 });
  entries.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.createdAt - y.createdAt));
  let run = Number(a.initial) || 0;
  for (const e of entries) { run += e.v; e.run = run; }
  entries.reverse();
  const shown = entries.slice(0, 150);
  const list = shown.length ? groupByDate(shown, (e) => (e.t ? txRow(e.t, { accountId: a.id, running: naturalBalance(a, e.run) }) : msiRow(e.m, C))) : `<p class="muted center">Sin movimientos.</p>`;
  const html = head + section("Movimientos", `<div class="card list">${list}<div class="row static"><i class="ico">🏁</i><div class="mid"><div class="t1">Saldo inicial</div><div class="t2">${a.initialDate ? fmtDate(a.initialDate) : ""}</div></div><div class="end"><b class="amt">${money(naturalBalance(a, Number(a.initial) || 0))}</b></div></div></div>`);
  return { title: a.name, back: true, action: `<button class="icon-btn" data-act="editAccount" data-id="${a.id}" aria-label="Editar">✎</button>`, html };
}

// ================= PERSONAS =================
export function people() {
  const s = S();
  const C = compute(s);
  const p = st.partner();
  let html = "";
  if (p) {
    const bal = C.ppl[p.id];
    html += `<a class="card partner" href="#/cortes">
      <div class="pc-top"><span class="avatar">${esc(p.name[0] || "?")}</span><div><b>${esc(p.name)}</b><small>Cortes y gastos compartidos</small></div></div>
      <div class="pc-amt ${moneyCls(bal)}"><small>${Math.abs(bal) < 0.01 ? "Están a mano" : bal > 0 ? "Te debe" : "Le debes"}</small><b>${money(Math.abs(bal))}</b></div>
      <div class="pc-foot">Ver corte actual →</div></a>`;
  }
  const others = s.people.filter((x) => !x.archived && x.id !== p?.id).sort((a, b) => Math.abs(C.ppl[b.id]) - Math.abs(C.ppl[a.id]));
  html += `<div class="stats2 card"><div><small>Te deben</small><b class="pos">${money(C.owedToMe)}</b></div><div><small>Debes</small><b class="neg">${money(C.iOwe)}</b></div></div>`;
  html += section("Familia y amigos", others.length ? `<div class="card list">${others.map((x) => personRow(x, C)).join("")}</div>` :
    empty("🤝", "Nadie todavía", "Agrega a tu papá, amigos o a quien le prestes o te preste dinero.", `<button class="btn primary" data-act="newPerson">＋ Agregar persona</button>`),
    `<button class="sec-link" data-act="add" data-kind="person">＋ Movimiento</button>`);
  const arch = s.people.filter((x) => x.archived);
  if (arch.length) html += `<details class="archived"><summary>Archivados (${arch.length})</summary><div class="card list">${arch.map((x) => personRow(x, C)).join("")}</div></details>`;
  if (!p) html += `<p class="muted pad">¿Compartes gastos con tu pareja? Agrégala y marca “Es mi pareja” para usar los cortes.</p>`;
  return { title: "Personas", action: `<button class="icon-btn" data-act="newPerson" aria-label="Nueva persona">＋</button>`, html };
}
function personRow(p, C) {
  const bal = C.ppl[p.id];
  const pi = planInfo(S(), p);
  return `<a class="row" href="#/persona/${p.id}"><span class="avatar sm">${esc(p.name[0] || "?")}</span>
    <div class="mid"><div class="t1">${esc(p.name)}</div><div class="t2">${esc(p.relation || "")}${pi ? ` · plan ${money0(pi.amount)}/${p.plan.freq}${pi.diff < -0.01 ? ` · <span class="warn-t">atrasado ${money0(-pi.diff)}</span>` : ""}` : ""}</div></div>
    <div class="end"><b class="amt ${moneyCls(bal)}">${money(Math.abs(bal))}</b><small>${Math.abs(bal) < 0.01 ? "a mano" : bal > 0 ? "te debe" : "le debes"}</small></div></a>`;
}

export function personDetail(id) {
  const s = S();
  const p = st.person(id);
  if (!p) return { title: "Persona", back: true, html: empty("❓", "No existe", "") };
  const C = compute(s);
  const bal = C.ppl[p.id];
  const pi = planInfo(s, p);
  const ev = personEvents(s, p.id);
  let html = `<div class="hero small"><small>${Math.abs(bal) < 0.01 ? "Están a mano" : bal > 0 ? `${esc(p.name)} te debe` : `Le debes a ${esc(p.name)}`}</small><div class="big ${moneyCls(bal)}">${money(Math.abs(bal))}</div></div>
    <div class="actions">
      <button class="btn primary" data-act="add" data-kind="person" data-person="${p.id}" data-pkind="collect">Me pagó</button>
      <button class="btn" data-act="add" data-kind="person" data-person="${p.id}" data-pkind="lend">Le presté</button>
      <button class="btn" data-act="add" data-kind="person" data-person="${p.id}" data-pkind="owesMe">Me debe</button>
      <button class="btn" data-act="add" data-kind="person" data-person="${p.id}" data-pkind="iOwe">Le debo</button>
      <button class="btn" data-act="add" data-kind="person" data-person="${p.id}" data-pkind="repay">Le pagué</button>
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
  const rows = ev.map((e) => {
    const title = e.tx ? txTitle(e.tx) : `${e.msi.concept} (${e.k}/${e.msi.months})`;
    return `<button class="row" data-act="${e.tx ? "tx" : "msi"}" data-id="${e.tx ? e.tx.id : e.msi.id}"><i class="ico">${e.amount >= 0 ? "↗" : "↙"}</i>
      <div class="mid"><div class="t1">${esc(title)}</div><div class="t2">${EVENT_LABEL[e.kind]}${e.tx?.accountId ? " · " + esc(accName(e.tx.accountId)) : ""}</div></div>
      <div class="end"><b class="amt ${moneyCls(e.amount)}">${moneySigned(e.amount)}</b></div></button>`;
  });
  html += section("Historial", `<div class="card list">${ev.length ? groupByDate(ev.map((e, i) => ({ ...e, i })), (e) => rows[e.i]) : ""}
    ${p.initial ? `<div class="row static"><i class="ico">🏁</i><div class="mid"><div class="t1">Saldo de antes</div></div><div class="end"><b class="amt ${moneyCls(p.initial)}">${moneySigned(p.initial)}</b></div></div>` : ""}
    ${!ev.length && !p.initial ? `<p class="muted center">Sin movimientos.</p>` : ""}</div>
    <p class="fine">+ aumenta lo que te debe · − lo reduce</p>`);
  return { title: p.name, back: true, action: `<button class="icon-btn" data-act="editPerson" data-id="${p.id}" aria-label="Editar">✎</button>`, html };
}

// ================= CORTES CON LA PAREJA =================
export function cortes(ui) {
  const s = S();
  const p = st.partner();
  if (!p) return { title: "Cortes", back: true, html: empty("💑", "Sin pareja configurada", "Agrega a tu pareja en Personas y marca “Es mi pareja”.", `<button class="btn primary" data-act="newPerson">＋ Agregar</button>`) };
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
        <span>→</span>
        <label><small>Hasta</small><input type="date" data-act="corteEnd" value="${end}" min="${start}"/></label>
      </div>
      ${due ? `<p class="banner warn">Ya pasó la fecha de corte. Ciérralo para empezar el siguiente.</p>` : ""}
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
        <button class="btn primary" data-act="closeCorte" data-start="${start}" data-end="${end}">✂️ Cerrar corte</button>
        <button class="btn" data-act="add" data-kind="expense" data-split="partner">＋ Gasto compartido</button>
        <button class="btn" data-act="add" data-kind="partnerPaid">🧾 ${esc(p.name)} pagó</button>
      </div>
    </div>`;
  const rows = sum.items.map((e) => {
    const title = e.tx ? txTitle(e.tx) : `${e.msi.concept} (${e.k}/${e.msi.months})`;
    const extra = e.tx?.type === "expense" ? ` · total ${money0(e.tx.amount)}` : e.tx?.total ? ` · total ${money0(e.tx.total)}` : "";
    return `<button class="row" data-act="${e.tx ? "tx" : "msi"}" data-id="${e.tx ? e.tx.id : e.msi.id}"><i class="ico">${e.tx ? catOf(e.tx.categoryId)?.icon || TYPE_ICON[e.tx.type] : "🗓️"}</i>
      <div class="mid"><div class="t1">${esc(title)}</div><div class="t2">${fmtDate(e.date)} · ${EVENT_LABEL[e.kind]}${extra}</div></div>
      <div class="end"><b class="amt ${moneyCls(e.amount)}">${moneySigned(e.amount)}</b></div></button>`;
  });
  html += section("Movimientos del corte", sum.items.length ? `<div class="card list">${rows.reverse().join("")}</div>` : `<p class="muted">Nada en este corte todavía.</p>`);
  const hist = [...s.cortes].sort((a, b) => (a.end < b.end ? 1 : -1));
  if (hist.length) {
    html += section("Cortes anteriores", `<div class="card list">${hist.map((k, i) => `
      <div class="row static"><i class="ico">✂️</i><div class="mid"><div class="t1">${fmtRange(k.start, k.end)}</div>
        <div class="t2">${k.closing > 0 ? `${esc(p.name)} debía` : k.closing < 0 ? "Le debías" : "A mano"} ${money(Math.abs(k.closing))}${k.paid ? ` · pagado ${money(Math.abs(k.paid))}` : ""}${k.note ? " · " + esc(k.note) : ""}</div></div>
        ${i === 0 ? `<button class="pill" data-act="reopenCorte" data-id="${k.id}">Reabrir</button>` : ""}</div>`).join("")}</div>`);
  }
  html += `<p class="fine pad">Cortes ${s.settings.corteFreq === "weekly" ? "semanales" : s.settings.corteFreq === "biweekly" ? "cada 2 semanas" : "mensuales"} · ${esc(p.name)} paga ${s.settings.partnerPct}% de lo compartido. Cámbialo en Más → Ajustes. Puedes mover la fecha “Hasta” cuando quieras.</p>`;
  return { title: `Cortes con ${p.name}`, back: true, html };
}

// ================= MÁS =================
export function more() {
  const s = S();
  const items = [
    ["#/movs", "📜", "Movimientos", `${s.tx.length} registrados`],
    ["#/cortes", "✂️", "Cortes con tu pareja", st.partner()?.name || "Sin configurar"],
    ["#/fondo", "🏠", "Fondo común", s.settings.fund.accountId ? accName(s.settings.fund.accountId) : "Sin configurar"],
    ["#/metas", "🌱", "Metas de ahorro", `${s.goals.length} metas`],
    ["#/msi", "🗓️", "Meses sin intereses", `${s.msi.filter((m) => !msiInfo(m).done).length} vigentes`],
    ["#/cuadrar", "⚖️", "Cuadrar cuentas", ""],
    ["#/categorias", "🏷️", "Categorías", ""],
    ["#/respaldo", "💾", "Respaldo", s.settings.lastBackup ? `último ${fmtDate(s.settings.lastBackup)}` : "nunca"],
    ["#/ajustes", "⚙️", "Ajustes", ""],
  ];
  return { title: "Más", html: `<div class="card list">${items.map(([h, i, t, sub]) => `<a class="row" href="${h}"><i class="ico">${i}</i><div class="mid"><div class="t1">${t}</div>${sub ? `<div class="t2">${esc(sub)}</div>` : ""}</div><span class="chev">›</span></a>`).join("")}</div>
    <p class="fine pad center">Cuadra · tus datos viven en este teléfono</p>` };
}

// ================= MOVIMIENTOS =================
export function movements(ui) {
  const s = S();
  const C = compute(s);
  const f = ui.movFilter;
  const q = (f.q || "").toLowerCase();
  let list = s.tx.filter((t) => (f.all ? true : monthKey(t.date) === ui.month));
  if (f.type) list = list.filter((t) => (f.type === "people" ? ["lend", "collect", "borrow", "repay", "debt"].includes(t.type) : t.type === f.type));
  if (f.account) list = list.filter((t) => t.accountId === f.account || t.toAccountId === f.account);
  if (q) list = list.filter((t) => `${txTitle(t)} ${txSub(t)} ${t.note || ""}`.toLowerCase().includes(q) || String(t.amount).includes(q));
  list.sort(sortTx);
  const msis = !f.type || f.type === "msi" ? s.msi.filter((m) => (f.all || monthKey(m.date) === ui.month) && (!f.account || m.accountId === f.account) && (!q || (m.concept || "").toLowerCase().includes(q))) : [];
  if (f.type === "msi") list = [];
  const merged = [...list.map((t) => ({ t, date: t.date })), ...msis.map((m) => ({ m, date: m.date }))].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const shown = merged.slice(0, 400);
  const typeOpts = [["", "Todo"], ["expense", "Gastos"], ["income", "Ingresos"], ["transfer", "Pagos / transf."], ["people", "Personas"], ["msi", "MSI"], ["adjust", "Ajustes"]];
  const html = `
    <div class="filters">
      <input type="search" placeholder="Buscar…" value="${esc(f.q || "")}" data-filter="q"/>
      <select data-filter="type">${typeOpts.map(([v, l]) => `<option value="${v}" ${f.type === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-filter="account"><option value="">Todas las cuentas</option>${s.accounts.map((a) => `<option value="${a.id}" ${f.account === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
    </div>
    <div class="month-nav card">${f.all ? `<b>Todos los meses</b>` : `<button data-act="month" data-d="-1">‹</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">›</button>`}<button class="pill" data-act="toggleAll">${f.all ? "Por mes" : "Ver todo"}</button></div>
    ${shown.length ? `<div class="card list">${groupByDate(shown, (x) => (x.t ? txRow(x.t) : msiRow(x.m, C)))}</div>` : `<p class="muted center pad">Sin movimientos.</p>`}
    ${merged.length > shown.length ? `<p class="fine center">Mostrando ${shown.length} de ${merged.length}. Usa los filtros.</p>` : ""}`;
  return { title: "Movimientos", back: true, html };
}

// ================= FONDO COMÚN =================
export function fund(ui) {
  const s = S();
  const C = compute(s);
  const f = s.settings.fund;
  const p = st.partner();
  if (!f.accountId || !st.account(f.accountId)) {
    const opts = s.accounts.filter((a) => a.type !== "credit" && !a.archived);
    return { title: "Fondo común", back: true, html: empty("🏠", "Configura tu fondo común", `Es una cuenta tuya a donde tú${p ? " y " + esc(p.name) : ""} aportan cada mes, y de ahí se pagan renta, súper y servicios.`,
      `<button class="btn primary" data-act="newFundAccount">＋ Crear cuenta “Fondo común”</button>
       ${opts.length ? `<div class="field"><span class="lbl">o usa una cuenta existente</span><select data-act="pickFund"><option value="">Elegir…</option>${opts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></div>` : ""}`) };
  }
  const fs = fundStats(s, ui.month, C);
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  let html = `
    <div class="hero small"><small>Saldo del fondo · ${esc(accName(f.accountId))}</small><div class="big ${moneyCls(fs.balance)}">${money(fs.balance)}</div></div>
    <div class="month-nav card"><button data-act="month" data-d="-1">‹</button><b>${fmtMonth(ui.month)}</b><button data-act="month" data-d="1">›</button></div>
    <div class="actions">
      <button class="btn primary" data-act="add" data-kind="fundIn">＋ Yo aporto</button>
      ${p ? `<button class="btn" data-act="add" data-kind="fundPartner">＋ Aporta ${esc(p.name)}</button>` : ""}
      <button class="btn" data-act="add" data-kind="fundExpense">💸 Pagar de la casa</button>
    </div>`;
  html += section("Aportaciones del mes", `<div class="card">
    <div class="contrib"><span>Yo (${fs.myPct}%)</span>${bar(pct(fs.contribMe, fs.expectedMe), fs.contribMe >= fs.expectedMe && fs.expectedMe ? "done" : "")}<b>${money0(fs.contribMe)} / ${money0(fs.expectedMe)}</b></div>
    ${p ? `<div class="contrib"><span>${esc(p.name)} (${100 - fs.myPct}%)</span>${bar(pct(fs.contribPartner, fs.expectedPartner), fs.contribPartner >= fs.expectedPartner && fs.expectedPartner ? "done" : "")}<b>${money0(fs.contribPartner)} / ${money0(fs.expectedPartner)}</b></div>` : ""}
    ${fs.contribOther ? kv("Otros", money(fs.contribOther)) : ""}
    ${p && fs.expectedPartner - fs.contribPartner > 0.01 ? `<p class="fine">A ${esc(p.name)} le faltan ${money(fs.expectedPartner - fs.contribPartner)} este mes.</p>` : ""}
    ${fs.expectedMe - fs.contribMe > 0.01 ? `<p class="fine">A ti te faltan ${money(fs.expectedMe - fs.contribMe)}.</p>` : ""}
  </div>`);
  html += section("Presupuesto de la casa", fs.lines.length ? `<div class="card">${fs.lines.map((l) => {
    const c = catOf(l.categoryId);
    const over = l.amount && l.spent > l.amount;
    return `<div class="budget-row"><div class="bt"><span>${c ? c.icon + " " : ""}${esc(l.name || c?.name || "Otras salidas")}${l.extra ? ' <em class="tag">fuera de presupuesto</em>' : ""}</span><b class="${over ? "neg" : ""}">${money0(l.spent)}${l.amount ? ` / ${money0(l.amount)}` : ""}</b></div>${l.amount ? bar(pct(l.spent, l.amount), over ? "hot" : "") : ""}</div>`;
  }).join("")}${kv("Total gastado", `${money(fs.spent)} de ${money(fs.budgetTotal)}`, "total")}</div>` : `<p class="muted">Define tus gastos fijos (renta, súper, luz…).</p>`,
    `<button class="sec-link" data-act="budget">Editar</button>`);
  html += section("Movimientos del fondo", fs.items.length ? `<div class="card list">${groupByDate(fs.items, (t) => txRow(t, { accountId: f.accountId }))}</div>` : `<p class="muted">Sin movimientos este mes.</p>`);
  return { title: "Fondo común", back: true, html };
}

// ================= METAS =================
function goalRow(g, C) {
  const gp = goalProgress(S(), g, C);
  return `<a class="row" href="#/meta/${g.id}"><i class="ico">${esc(g.icon || "🌱")}</i>
    <div class="mid"><div class="t1">${esc(g.name)}</div><div class="t2">${money0(gp.current)} de ${money0(gp.target)}${gp.perMonth ? ` · ${money0(gp.perMonth)}/mes` : ""}</div>${bar(gp.pct, gp.done ? "done" : "")}</div>
    <div class="end"><b class="amt">${gp.pct.toFixed(0)}%</b></div></a>`;
}
export function goals() {
  const s = S();
  const C = compute(s);
  const html = s.goals.length ? `<div class="card list">${s.goals.map((g) => goalRow(g, C)).join("")}</div>` :
    empty("🌱", "Sin metas", "Crea metas: vivir en otro lugar, la boda, un fondo de emergencia…", `<button class="btn primary" data-act="newGoal">＋ Nueva meta</button>`);
  return { title: "Metas de ahorro", back: true, action: `<button class="icon-btn" data-act="newGoal" aria-label="Nueva meta">＋</button>`, html };
}
export function goalDetail(id) {
  const s = S();
  const g = s.goals.find((x) => x.id === id);
  if (!g) return { title: "Meta", back: true, html: empty("❓", "No existe", "") };
  const C = compute(s);
  const gp = goalProgress(s, g, C);
  const mode = { manual: "Aportaciones que registras", account: `Saldo de ${accName(g.accountId)}`, networth: "Tu patrimonio neto" }[g.mode];
  let html = `<div class="hero small"><small>${esc(g.icon || "🌱")} ${esc(g.name)}</small><div class="big">${money(gp.current)}</div>${bar(gp.pct, gp.done ? "done" : "")}<small>${gp.pct.toFixed(1)}% de ${money(gp.target)}</small></div>
    <div class="card">
      ${kv("Se mide con", esc(mode))}
      ${kv("Falta", money(gp.remaining))}
      ${g.deadline ? kv("Fecha objetivo", fmtDate(g.deadline, { year: true })) : ""}
      ${gp.perMonth ? kv("Necesitas por mes", money(gp.perMonth)) : ""}
      ${g.mode === "manual" ? kv("Aportado este mes", money(gp.thisMonth)) : ""}
    </div>`;
  if (g.mode === "manual") {
    const cs = [...g.contributions].sort((a, b) => (a.date < b.date ? 1 : -1));
    html += `<div class="actions"><button class="btn primary" data-act="contrib" data-id="${g.id}">＋ Aportar</button></div>`;
    html += section("Aportaciones", cs.length ? `<div class="card list">${cs.map((c) => `<button class="row" data-act="contrib" data-id="${g.id}" data-cid="${c.id}"><i class="ico">${c.amount >= 0 ? "🌱" : "↩️"}</i><div class="mid"><div class="t1">${esc(c.note || (c.amount >= 0 ? "Aportación" : "Retiro"))}</div><div class="t2">${fmtDate(c.date)}</div></div><div class="end"><b class="amt ${moneyCls(c.amount)}">${moneySigned(c.amount)}</b></div></button>`).join("")}</div>` : `<p class="muted">Aún sin aportaciones.</p>`);
  }
  return { title: g.name, back: true, action: `<button class="icon-btn" data-act="editGoal" data-id="${g.id}" aria-label="Editar">✎</button>`, html };
}

// ================= MSI =================
export function msiList() {
  const s = S();
  const C = compute(s);
  const active = s.msi.filter((m) => !C.msi[m.id].done);
  const doneL = s.msi.filter((m) => C.msi[m.id].done);
  const totRem = active.reduce((x, m) => x + C.msi[m.id].remaining, 0);
  const totMon = active.reduce((x, m) => x + C.msi[m.id].monthly, 0);
  let html = `<div class="stats2 card"><div><small>Por pagar</small><b>${money(totRem)}</b></div><div><small>Mensualidades</small><b>${money(totMon)}</b></div></div>
    <p class="fine pad">El mes en que vas se calcula solo con la fecha de la primera mensualidad. Ya no tienes que actualizarlo a mano.</p>`;
  const cards = [...new Set(active.map((m) => m.accountId))];
  for (const id of cards) html += section(accName(id), `<div class="card list">${active.filter((m) => m.accountId === id).map((m) => msiRow(m, C)).join("")}</div>`);
  if (!active.length) html += empty("🗓️", "Sin MSI vigentes", "Registra tus compras a meses y la app lleva la cuenta de cada mensualidad.", `<button class="btn primary" data-act="add" data-kind="msi">＋ Compra a MSI</button>`);
  if (doneL.length) html += `<details class="archived"><summary>Liquidadas (${doneL.length})</summary><div class="card list">${doneL.map((m) => msiRow(m, C)).join("")}</div></details>`;
  return { title: "Meses sin intereses", back: true, action: `<button class="icon-btn" data-act="add" data-kind="msi" aria-label="Nueva">＋</button>`, html };
}

// ================= CATEGORÍAS =================
export function categories() {
  const s = S();
  const row = (c) => `<button class="row" data-act="editCat" data-id="${c.id}"><i class="ico">${esc(c.icon)}</i><div class="mid"><div class="t1">${esc(c.name)}</div>${c.kind === "income" && c.real === false ? `<div class="t2">no cuenta como ingreso</div>` : ""}</div><span class="chev">›</span></button>`;
  const html = section("Gastos", `<div class="card list">${s.categories.filter((c) => c.kind === "expense").map(row).join("")}</div>`, `<button class="sec-link" data-act="newCat" data-kind="expense">＋</button>`) +
    section("Ingresos", `<div class="card list">${s.categories.filter((c) => c.kind === "income").map(row).join("")}</div>`, `<button class="sec-link" data-act="newCat" data-kind="income">＋</button>`);
  return { title: "Categorías", back: true, html };
}

// ================= RESPALDO =================
export function backup() {
  const s = S();
  const html = `
    <div class="card">
      <p>Tus datos se guardan <b>solo en este teléfono</b>. Exporta un respaldo seguido y guárdalo en Archivos / iCloud Drive.</p>
      ${kv("Último respaldo", s.settings.lastBackup ? fmtDate(s.settings.lastBackup, { year: true }) : "Nunca")}
      ${kv("Movimientos", String(s.tx.length))}
      <div class="actions col">
        <button class="btn primary" data-act="export">💾 Exportar respaldo (.json)</button>
        <button class="btn" data-act="exportCsv">📊 Exportar movimientos a Excel (.csv)</button>
        <label class="btn">📥 Importar respaldo<input type="file" accept=".json,application/json" data-act="import" hidden/></label>
      </div>
    </div>
    ${section("Zona de peligro", `<div class="card"><button class="btn danger full" data-act="wipe">Borrar todos los datos</button></div>`)}`;
  return { title: "Respaldo", back: true, html };
}

// ================= AJUSTES =================
export function settings() {
  const s = S();
  const st2 = s.settings;
  const ppl = s.people.filter((p) => !p.archived);
  const html = `
    <div class="card form">
      <label class="field"><span class="lbl">Tu nombre</span><input data-setting="name" value="${esc(st2.name)}" placeholder="Fer"/></label>
      <label class="field"><span class="lbl">Tu pareja</span><select data-setting="partnerId"><option value="">— Ninguna —</option>${ppl.map((p) => `<option value="${p.id}" ${st2.partnerId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">% que paga tu pareja en gastos compartidos</span><input data-setting="partnerPct" inputmode="decimal" value="${st2.partnerPct}"/></label>
      <label class="field"><span class="lbl">Frecuencia de cortes</span><select data-setting="corteFreq">
        ${[["weekly", "Cada semana"], ["biweekly", "Cada 2 semanas"], ["monthly", "Cada mes"]].map(([v, l]) => `<option value="${v}" ${st2.corteFreq === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${!s.cortes.length ? `<label class="field"><span class="lbl">Inicio del primer corte</span><input type="date" data-setting="corteStart" value="${st2.corteStart || ""}"/><small class="hint">El corte dura desde este día. Ej. si cortas los domingos, empieza un lunes. Hoy es ${DIAS_L[new Date().getDay()]}.</small></label>` : ""}
      <label class="field"><span class="lbl">Mi % en el fondo común</span><input data-setting="fundPct" inputmode="decimal" value="${st2.fund.myPct}"/></label>
    </div>
    <p class="fine pad">Los cambios se guardan solos.</p>`;
  return { title: "Ajustes", back: true, html };
}
