// ================= Cálculos: saldos, MSI, personas, cortes, fondo, metas =================
// Convención de saldo de una cuenta: positivo = dinero que tienes;
// en tarjetas de crédito el saldo es NEGATIVO cuando debes (deuda = −saldo).
import { round2, today, addDays, addMonths, monthKey, parseYmd } from "./format.js";

const r2 = round2;

// ---------- Movimientos → efecto en cuentas ----------
export function txAccountEffects(t) {
  if (t.hist) return []; // histórico importado: solo para análisis, no mueve saldos
  const a = Number(t.amount) || 0;
  switch (t.type) {
    case "expense": return [[t.accountId, -a]];
    case "income": return [[t.accountId, a]];
    case "transfer": return [[t.accountId, -a], [t.toAccountId, a]];
    case "adjust": return [[t.accountId, a]]; // con signo
    case "lend": case "repay": return t.accountId ? [[t.accountId, -a]] : [];
    case "collect": case "borrow": return t.accountId ? [[t.accountId, a]] : [];
    default: return [];
  }
}

// ---------- Movimientos → efecto con personas (positivo = te deben) ----------
export function txPersonEffects(t) {
  if (t.hist) return [];
  const a = Number(t.amount) || 0;
  const out = [];
  if (t.type === "expense") {
    for (const s of t.shares || []) if (s.personId && s.amount) out.push([s.personId, Number(s.amount), Math.abs(s.amount - a) < 0.01 ? "full" : "share"]);
  } else if (t.personId) {
    if (t.type === "lend") out.push([t.personId, a, "lend"]);
    if (t.type === "repay") out.push([t.personId, a, "repay"]);
    if (t.type === "collect") out.push([t.personId, -a, "collect"]);
    if (t.type === "borrow") out.push([t.personId, -a, "borrow"]);
    if (t.type === "debt") out.push([t.personId, t.dir === "iOwe" ? -a : a, t.dir === "iOwe" ? "iOwe" : "owesMe"]);
  }
  return out;
}

// ---------- MSI (meses sin intereses) ----------
export const msiMonthly = (m) => r2((Number(m.total) || 0) / Math.max(1, Number(m.months) || 1));
export const msiDate = (m, k) => addMonths(m.firstDate, k - 1); // k = 1..months

export function msiInfo(m, on = today()) {
  const months = Math.max(1, Number(m.months) || 1);
  const monthly = msiMonthly(m);
  let byDate = 0;
  while (byDate < months && msiDate(m, byDate + 1) <= on) byDate++;
  const paid = Math.max(0, Math.min(months, byDate + (Number(m.offset) || 0)));
  const remaining = Math.max(0, r2(Number(m.total) - paid * monthly - (Number(m.extraPaid) || 0)));
  const done = remaining <= 0.01;
  const nextDate = !done && paid < months ? msiDate(m, paid + 1) : null;
  const othersPct = (m.shares || []).reduce((s, x) => s + (Number(x.pct) || 0), 0);
  return { months, monthly, paid, remaining, done, nextDate, myPct: Math.max(0, 100 - othersPct) };
}

/** Mensualidades programadas entre dos fechas (incluyentes). */
export function msiInstallments(m, from, to) {
  const out = [];
  const months = Math.max(1, Number(m.months) || 1);
  for (let k = 1; k <= months; k++) {
    const d = msiDate(m, k);
    if (d > to) break;
    if (d >= from) out.push({ k, date: d, amount: msiMonthly(m) });
  }
  return out;
}

// ---------- Resultado global ----------
export function compute(S) {
  const t0 = today();
  const acc = {};
  for (const a of S.accounts) acc[a.id] = Number(a.initial) || 0;
  for (const t of S.tx) for (const [id, v] of txAccountEffects(t)) if (id in acc) acc[id] += v;
  const msi = {};
  for (const m of S.msi) {
    msi[m.id] = msiInfo(m, t0);
    const a = S.accounts.find((x) => x.id === m.accountId);
    // compras a MSI anteriores al saldo inicial ya están incluidas en él
    if (a && (!a.initialDate || m.date >= a.initialDate)) acc[a.id] -= Number(m.total) || 0;
  }
  for (const k in acc) acc[k] = r2(acc[k]);

  const ppl = {};
  for (const p of S.people) ppl[p.id] = r2((Number(p.initial) || 0) + personEvents(S, p.id).reduce((s, e) => s + e.amount, 0));

  const assets = S.accounts.filter((a) => !a.archived).reduce((s, a) => s + acc[a.id], 0);
  const owedToMe = Object.values(ppl).filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const iOwe = Object.values(ppl).filter((v) => v < 0).reduce((s, v) => s + v, 0);
  return { acc, ppl, msi, netWorth: r2(assets + owedToMe + iOwe), owedToMe: r2(owedToMe), iOwe: r2(-iOwe) };
}

// ---------- Eventos de una persona (para historial y cortes) ----------
export function personEvents(S, pid, upto = today()) {
  const ev = [];
  for (const t of S.tx) {
    for (const [id, amount, kind] of txPersonEffects(t)) if (id === pid) ev.push({ date: t.date, amount: r2(amount), kind, tx: t });
  }
  for (const m of S.msi) {
    const sh = (m.shares || []).find((s) => s.personId === pid);
    if (!sh || !sh.pct) continue;
    for (const ins of msiInstallments(m, m.trackFrom || "0000-00-00", upto)) {
      ev.push({ date: ins.date, amount: r2((ins.amount * sh.pct) / 100), kind: "msi", msi: m, k: ins.k });
    }
  }
  ev.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return ev;
}

export function personBalanceBefore(S, pid, date) {
  const p = S.people.find((x) => x.id === pid);
  return r2((Number(p?.initial) || 0) + personEvents(S, pid).filter((e) => e.date < date).reduce((s, e) => s + e.amount, 0));
}

export const EVENT_LABEL = {
  share: "Gasto compartido (su parte)",
  full: "Gasto 100% suyo",
  msi: "Mensualidad MSI",
  lend: "Le prestaste",
  repay: "Le pagaste",
  collect: "Te pagó",
  borrow: "Te prestó",
  owesMe: "Te debe",
  iOwe: "Pagó por ti / le debes",
};

// ---------- Plan de pagos (ej. papá: $811 por quincena) ----------
function planDate(plan, k) {
  if (plan.freq === "semanal") return addDays(plan.start, 7 * k);
  if (plan.freq === "quincenal") return k % 2 === 0 ? addMonths(plan.start, k / 2) : addDays(addMonths(plan.start, (k - 1) / 2), 15);
  return addMonths(plan.start, k);
}
export function planInfo(S, p, on = today()) {
  const plan = p.plan;
  if (!plan || !plan.amount || !plan.start) return null;
  const amount = Number(plan.amount);
  const total = Number(plan.total) || 0;
  const maxPeriods = total ? Math.ceil(total / amount - 1e-9) : 600;
  let periods = 0;
  while (periods < maxPeriods && planDate(plan, periods) <= on) periods++;
  const expected = r2(total ? Math.min(total, periods * amount) : periods * amount);
  const paidTx = S.tx.filter((t) => t.personId === p.id && t.type === "collect" && t.planPayment).reduce((s, t) => s + Number(t.amount), 0);
  const paid = r2((Number(plan.paidBefore) || 0) + paidTx);
  const next = periods < maxPeriods ? planDate(plan, periods) : null;
  return { amount, total, periods, maxPeriods, expected, paid, diff: r2(paid - expected), next, pct: total ? Math.min(100, (paid / total) * 100) : 0 };
}

// ---------- Tarjetas de crédito ----------
export function nextDayOfMonth(day, from = today()) {
  if (!day) return null;
  const d = parseYmd(from);
  const mk = (y, m) => {
    const last = new Date(y, m + 1, 0).getDate();
    const x = new Date(y, m, Math.min(day, last));
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const c = mk(d.getFullYear(), d.getMonth());
  return c >= from ? c : mk(d.getFullYear(), d.getMonth() + 1);
}

export function cardInfo(S, a, C) {
  const bal = C.acc[a.id] || 0;
  const debt = r2(Math.max(0, -bal));
  const plans = S.msi.filter((m) => m.accountId === a.id && !C.msi[m.id].done);
  const msiRemaining = r2(plans.reduce((s, m) => s + C.msi[m.id].remaining, 0));
  const msiMonthly = r2(plans.reduce((s, m) => s + C.msi[m.id].monthly, 0));
  const limit = Number(a.limit) || 0;
  return {
    bal, debt, msiRemaining, msiMonthly, plans,
    debtNoMsi: r2(Math.max(0, debt - msiRemaining)),
    credit: bal > 0 ? bal : 0, // saldo a favor
    limit, available: r2(limit - debt),
    usedPct: limit ? Math.min(100, (debt / limit) * 100) : 0,
    nextCut: nextDayOfMonth(Number(a.cutoffDay)),
    nextDue: nextDayOfMonth(Number(a.dueDay)),
  };
}

// ---------- Estadísticas del mes (gasto REAL: sin pagos a tarjetas ni lo que otros te deben) ----------
export function monthStats(S, key) {
  const fundId = S.settings.fund.accountId;
  const byCat = {};
  let spend = 0, income = 0, fundSpend = 0;
  const incomeByCat = {};
  const add = (cat, v) => { byCat[cat || "_"] = (byCat[cat || "_"] || 0) + v; spend += v; };
  for (const t of S.tx) {
    if (monthKey(t.date) !== key) continue;
    if (t.type === "expense") {
      if (t.accountId === fundId) { fundSpend += Number(t.amount); continue; }
      const mine = Number(t.amount) - (t.shares || []).reduce((s, x) => s + Number(x.amount || 0), 0);
      if (mine > 0) add(t.categoryId, mine);
    } else if (t.type === "debt" && t.dir === "iOwe" && t.categoryId) {
      add(t.categoryId, Number(t.amount));
    } else if (t.type === "income" && t.accountId !== fundId) {
      const c = S.categories.find((x) => x.id === t.categoryId);
      if (c && c.real === false) continue;
      income += Number(t.amount);
      incomeByCat[t.categoryId || "_"] = (incomeByCat[t.categoryId || "_"] || 0) + Number(t.amount);
    }
  }
  let msiMine = 0;
  for (const m of S.msi) {
    const info = msiInfo(m);
    // antes de trackFrom las mensualidades ya vienen en el histórico importado
    const from = m.trackFrom && m.trackFrom > `${key}-01` ? m.trackFrom : `${key}-01`;
    for (const ins of msiInstallments(m, from, `${key}-31`)) {
      const v = (ins.amount * info.myPct) / 100;
      if (v > 0) { add(m.categoryId, v); msiMine += v; }
    }
  }
  const cats = Object.entries(byCat).map(([id, v]) => ({ id, amount: r2(v) })).sort((a, b) => b.amount - a.amount);
  return { spend: r2(spend), income: r2(income), net: r2(income - spend), cats, msiMine: r2(msiMine), fundSpend: r2(fundSpend), incomeByCat };
}

// ---------- Cortes con tu pareja ----------
export function corteDefaultEnd(start, freq) {
  if (freq === "biweekly") return addDays(start, 13);
  if (freq === "monthly") return addDays(addMonths(start, 1), -1);
  return addDays(start, 6);
}

export function openCorteStart(S) {
  const pid = S.settings.partnerId;
  const last = [...S.cortes].sort((a, b) => (a.end < b.end ? 1 : -1))[0];
  if (last) return addDays(last.end, 1);
  if (S.settings.corteStart) return S.settings.corteStart;
  const ev = pid ? personEvents(S, pid) : [];
  return ev.length ? ev[ev.length - 1].date : addDays(today(), -6);
}

export function corteSummary(S, start, end) {
  const pid = S.settings.partnerId;
  const opening = personBalanceBefore(S, pid, start);
  const items = personEvents(S, pid, end).filter((e) => e.date >= start && e.date <= end).reverse();
  const groups = {};
  for (const e of items) groups[e.kind] = r2((groups[e.kind] || 0) + e.amount);
  const change = r2(items.reduce((s, e) => s + e.amount, 0));
  return { start, end, opening, items, groups, change, closing: r2(opening + change) };
}

// ---------- Fondo común ----------
export function fundStats(S, key, C) {
  const f = S.settings.fund;
  const fundId = f.accountId;
  const pid = S.settings.partnerId;
  const budget = (f.budget || []).map((b) => ({ ...b, amount: Number(b.amount) || 0 }));
  const budgetTotal = r2(budget.reduce((s, b) => s + b.amount, 0));
  let contribMe = 0, contribPartner = 0, contribOther = 0;
  const spentByCat = {};
  const items = [];
  for (const t of S.tx) {
    if (monthKey(t.date) !== key) continue;
    if (t.type === "transfer" && t.toAccountId === fundId) { contribMe += Number(t.amount); items.push(t); }
    else if (t.type === "income" && t.accountId === fundId) {
      if (t.personId && t.personId === pid) contribPartner += Number(t.amount);
      else if (t.personId) contribOther += Number(t.amount);
      else contribMe += Number(t.amount);
      items.push(t);
    } else if (t.accountId === fundId && (t.type === "expense" || t.type === "transfer")) {
      spentByCat[t.categoryId || "_"] = (spentByCat[t.categoryId || "_"] || 0) + Number(t.amount);
      items.push(t);
    } else if (t.accountId === fundId && t.type === "adjust") items.push(t);
  }
  const myPct = Number(f.myPct) || 0;
  // si dos líneas comparten categoría, el gasto se muestra solo en la primera
  const seen = new Set();
  const lines = budget.map((b) => {
    const first = !seen.has(b.categoryId);
    seen.add(b.categoryId);
    return { ...b, spent: first ? r2(spentByCat[b.categoryId] || 0) : 0 };
  });
  const budgetCats = new Set(budget.map((b) => b.categoryId));
  const extra = Object.entries(spentByCat).filter(([c]) => !budgetCats.has(c)).map(([categoryId, v]) => ({ categoryId, amount: 0, spent: r2(v), extra: true }));
  const spent = r2(Object.values(spentByCat).reduce((s, v) => s + v, 0));
  return {
    fundId, balance: fundId ? C.acc[fundId] ?? 0 : 0,
    budgetTotal, myPct,
    expectedMe: r2((budgetTotal * myPct) / 100), expectedPartner: r2((budgetTotal * (100 - myPct)) / 100),
    contribMe: r2(contribMe), contribPartner: r2(contribPartner), contribOther: r2(contribOther),
    lines: [...lines, ...extra], spent, items: items.sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

// ---------- Metas de ahorro ----------
export function goalProgress(S, g, C) {
  let current = 0;
  if (g.mode === "account") current = C.acc[g.accountId] ?? 0;
  else if (g.mode === "networth") current = C.netWorth;
  else current = (g.contributions || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  current = r2(current);
  const target = Number(g.target) || 0;
  const pct = target ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  const remaining = r2(Math.max(0, target - current));
  let perMonth = null, monthsLeft = null;
  if (g.deadline && remaining > 0) {
    const a = parseYmd(today()), b = parseYmd(g.deadline);
    monthsLeft = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
    perMonth = r2(remaining / monthsLeft);
  }
  const thisMonth = r2((g.contributions || []).filter((c) => monthKey(c.date) === monthKey(today())).reduce((s, c) => s + Number(c.amount || 0), 0));
  return { current, target, pct, remaining, perMonth, monthsLeft, thisMonth, done: target > 0 && current >= target };
}

/** Saldo que el app espera de una cuenta en su "unidad natural" (deuda para crédito). */
export const naturalBalance = (a, bal) => (a.type === "credit" ? -bal : bal);

// ---------- Gastos de casa (dividir con tu pareja) ----------
/** Desglose de un gasto de casa: quién pagó y cuánto le toca a cada quien. */
export function houseLine(S, t) {
  const fundId = S.settings.fund.accountId;
  const pid = S.settings.partnerId;
  const myPct = Number(S.settings.fund.myPct) || 0;
  if (t.type === "expense" && t.accountId === fundId) {
    const total = Number(t.amount);
    return { paidBy: "fund", total, mine: r2((total * myPct) / 100), theirs: r2(total - (total * myPct) / 100), settle: 0 };
  }
  if (t.type === "expense") {
    const total = Number(t.amount);
    const theirs = r2((t.shares || []).filter((x) => x.personId === pid).reduce((s, x) => s + Number(x.amount || 0), 0));
    return { paidBy: "me", total, mine: r2(total - theirs), theirs, settle: theirs };
  }
  if (t.type === "debt" && t.dir === "iOwe") {
    const total = Number(t.total ?? t.amount);
    return { paidBy: "partner", total, mine: Number(t.amount), theirs: r2(total - Number(t.amount)), settle: -Number(t.amount) };
  }
  return null;
}
export const isHouse = (S, t) => !!t.house || (t.type === "expense" && t.accountId && t.accountId === S.settings.fund.accountId);

export function houseStats(S, key) {
  const items = [];
  const sum = { total: 0, mine: 0, theirs: 0, settle: 0, me: 0, partner: 0, fund: 0 };
  const byCat = {};
  for (const t of S.tx) {
    if (monthKey(t.date) !== key || !isHouse(S, t)) continue;
    const l = houseLine(S, t);
    if (!l) continue;
    items.push({ t, ...l });
    sum.total += l.total; sum.mine += l.mine; sum.theirs += l.theirs; sum.settle += l.settle; sum[l.paidBy] += l.total;
    byCat[t.categoryId || "_"] = (byCat[t.categoryId || "_"] || 0) + l.total;
  }
  for (const k in sum) sum[k] = r2(sum[k]);
  items.sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : (b.t.createdAt || 0) - (a.t.createdAt || 0)));
  const budget = (S.settings.fund.budget || []).map((b) => ({ ...b, amount: Number(b.amount) || 0 }));
  const seen = new Set();
  const lines = budget.map((b) => { const first = !seen.has(b.categoryId); seen.add(b.categoryId); return { ...b, spent: first ? r2(byCat[b.categoryId] || 0) : 0 }; });
  const extra = Object.entries(byCat).filter(([c]) => !seen.has(c)).map(([categoryId, v]) => ({ categoryId, amount: 0, spent: r2(v), extra: true }));
  return { items, sum, lines: [...lines, ...extra], budgetTotal: r2(budget.reduce((s, b) => s + b.amount, 0)) };
}

/** Categorías ordenadas por uso (las que más usas primero). */
export function categoriesByUse(S, kind) {
  const n = {};
  for (const t of S.tx) if (t.categoryId) n[t.categoryId] = (n[t.categoryId] || 0) + 1;
  return S.categories.filter((c) => c.kind === kind).map((c, i) => ({ c, n: n[c.id] || 0, i })).sort((a, b) => (a.c.id === "c_otros") - (b.c.id === "c_otros") || b.n - a.n || a.i - b.i).map((x) => x.c);
}

// ---------- Análisis de varios meses ----------
const cleanConcept = (c) => String(c || "").replace(/\d+\s*\/\s*\d+/g, "").replace(/\b\d+\b/g, "").replace(/\b(msi|mes|último|ultimo)\b/gi, "").trim().split(/\s+/).slice(0, 2).join(" ");
const title = (x) => x.replace(/\b\w/g, (c) => c.toUpperCase());
export function merchantKey(t, brandFor) {
  if (t.merchant) return t.merchant;
  const b = brandFor(t.concept);
  if (b) return b.name;
  const c = cleanConcept(t.concept);
  return c ? title(c.toLowerCase()) : null;
}

/** Promedios de los últimos `n` meses completos (más el mes en curso como referencia). */
export function analysis(S, n, brandFor) {
  const cur = monthKey(today());
  const months = [];
  for (let i = n; i >= 1; i--) months.push(monthKey(addMonths(`${cur}-01`, -i)));
  const set = new Set(months);
  const fundId = S.settings.fund.accountId;
  const byMonth = Object.fromEntries([...months, cur].map((m) => [m, { spend: 0, mine: 0, work: 0, income: 0 }]));
  const mer = {}, cat = {}, card = {};
  let spend = 0, mine = 0, others = 0, work = 0, income = 0, subsSeen = 0, count = 0;
  const addSpend = (t, m, amount, myPart, accountId, catId, key) => {
    byMonth[m].spend += amount; byMonth[m].mine += myPart;
    if (!set.has(m)) return;
    spend += amount; mine += myPart; others += amount - myPart; count++;
    const k = key || S.categories.find((c) => c.id === catId)?.name || "Otros";
    const x = (mer[k] ||= { name: k, total: 0, n: 0, months: new Set(), acc: {}, sample: t, mine: 0 });
    x.total += amount; x.n++; x.months.add(m); x.mine += myPart; if (accountId) x.acc[accountId] = (x.acc[accountId] || 0) + 1;
    const c = (cat[catId || "_"] ||= { id: catId || "_", total: 0, mine: 0 });
    c.total += amount; c.mine += myPart;
    if (accountId) { const y = (card[accountId] ||= { id: accountId, total: 0 }); y.total += amount; }
    if (catId === "c_subs") subsSeen += amount;
  };
  for (const t of S.tx) {
    const m = monthKey(t.date);
    if (!byMonth[m]) continue;
    if (t.type === "expense" && !(t.accountId === fundId && !t.hist)) {
      const sh = (t.shares || []).reduce((q, x) => q + Number(x.amount || 0), 0);
      addSpend(t, m, Number(t.amount), Number(t.amount) - sh, t.accountId, t.categoryId, merchantKey(t, brandFor));
    } else if (t.type === "income") {
      const c = S.categories.find((x) => x.id === t.categoryId);
      if (c && c.real === false) continue;
      byMonth[m].income += Number(t.amount);
      if (t.categoryId === "i_trabajo") byMonth[m].work += Number(t.amount);
      if (set.has(m)) { income += Number(t.amount); if (t.categoryId === "i_trabajo") work += Number(t.amount); }
    }
  }
  for (const pl of S.msi) {
    const info = msiInfo(pl);
    for (const ins of msiInstallments(pl, pl.trackFrom || "0000-00-00", `${cur}-31`)) {
      const m = monthKey(ins.date);
      if (!byMonth[m]) continue;
      addSpend({ concept: pl.concept, categoryId: pl.categoryId }, m, ins.amount, (ins.amount * info.myPct) / 100, pl.accountId, pl.categoryId, merchantKey({ concept: pl.concept }, brandFor));
    }
  }
  const N = Math.max(1, n);
  const merchants = Object.values(mer).map((x) => ({ ...x, months: x.months.size, avg: r2(x.total / N), total: r2(x.total), ticket: r2(x.total / x.n), mine: r2(x.mine),
    card: Object.entries(x.acc).sort((a, b) => b[1] - a[1])[0]?.[0] || null })).sort((a, b) => b.total - a.total);
  const workMonths = months.map((m) => byMonth[m].work).sort((a, b) => a - b);
  const median = workMonths.length ? (workMonths[Math.floor((workMonths.length - 1) / 2)] + workMonths[Math.ceil((workMonths.length - 1) / 2)]) / 2 : 0;
  return {
    months, cur, byMonth, count,
    spend: r2(spend), avg: r2(spend / N), mine: r2(mine), avgMine: r2(mine / N), avgOthers: r2(others / N),
    work: r2(work), avgWork: r2(work / N), medianWork: r2(median), avgIncome: r2(income / N),
    saving: r2(work / N - mine / N),
    merchants,
    cats: Object.values(cat).map((c) => ({ ...c, avg: r2(c.total / N), total: r2(c.total) })).sort((a, b) => b.total - a.total),
    cards: Object.values(card).map((c) => ({ ...c, avg: r2(c.total / N), total: r2(c.total) })).sort((a, b) => b.total - a.total),
  };
}

// ---------- Suscripciones ----------
export const subMonthly = (x) => (x.freq === "anual" ? Number(x.amount) / 12 : Number(x.amount)) || 0;
export function subInfo(S, x, brandFor) {
  const next = x.day ? nextDayOfMonth(Number(x.day)) : null;
  // ¿se ha cobrado de verdad? busca el cargo más reciente que coincida
  const key = (x.match || x.name || "").toLowerCase().split(/[,(/]/)[0].trim();
  const b = brandFor(x.name);
  const hits = S.tx.filter((t) => t.type === "expense" && ((b && brandFor(t.concept)?.id === b.id) || (key && String(t.concept || "").toLowerCase().includes(key)) || (t.subId === x.id)))
    .sort((a, c) => (a.date < c.date ? 1 : -1));
  const last = hits[0] || null;
  const days = last ? daysBetweenLocal(last.date, today()) : null;
  const limit = x.freq === "anual" ? 380 : 40;
  let status = "ok";
  if (!x.active) status = "off";
  else if (!last || days > limit) status = "missing";
  else if (last.accountId && x.accountId && last.accountId !== x.accountId) status = "card";
  else if (Math.abs(Number(last.amount) - Number(x.amount)) > Math.max(5, Number(x.amount) * 0.1)) status = "amount";
  return { next, last, days, status, monthly: r2(subMonthly(x)) };
}
function daysBetweenLocal(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
