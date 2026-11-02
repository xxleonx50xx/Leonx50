// ================= Registro rápido con teclado numérico =================
// ＋ → monto con teclado grande → cuenta → categoría → Guardar (3–4 toques).
import * as st from "./store.js";
import { uid, ACCOUNT_TYPES } from "./store.js";
import { esc, money, parseAmount, round2, today, fmtDate } from "./format.js";
import { openSheet, closeSheet, toast } from "./ui.js";
import { compute, naturalBalance, categoriesByUse, limitsStatus } from "./calc.js";
import { monthKey } from "./format.js";
import { icon, brandFor, logo, iconTile, colorTile, CAT_COLOR, APPLE } from "./logos.js";

let refresh = () => {};
let openFull = () => {};
export const bindQuick = (r, full) => { refresh = r; openFull = full; };
const S = () => st.state();

export function accountTile(a, size = "") {
  const b = brandFor(a.name);
  return b ? logo(b, size) : iconTile(ACCOUNT_TYPES[a.type]?.ico || "wallet", "", size);
}
export function categoryTile(c, size = "") {
  if (!c) return iconTile("package", "", size);
  return c.ico ? colorTile(c.ico, CAT_COLOR[c.id] || APPLE.gray, size) : `<span class="tile emoji ${size}">${esc(c.icon || "•")}</span>`;
}

const KEYS = ["1", "2", "3", "back", "4", "5", "6", "+", "7", "8", "9", "save", ".", "0", "00"];

export function quickAdd(mode = "expense", preset = {}) {
  const s = S();
  if (!s.accounts.some((a) => !a.archived)) { toast("Primero agrega una cuenta"); location.hash = "#/cuentas"; return; }
  const p = st.partner();
  const fundId = s.settings.fund.accountId;
  const C = compute(s);
  const state = {
    mode, expr: preset.amount ? String(preset.amount) : "", date: preset.date || today(),
    accountId: preset.accountId || null, categoryId: preset.categoryId || null,
    split: preset.split === "half" ? 50 : preset.split ? Number(S().settings.partnerPct) || 40 : 0, payer: preset.payer || "me",
  };
  const accounts = () => s.accounts.filter((a) => !a.archived && !(state.mode === "house" && a.id === fundId));
  const pickDefaultAccount = () => {
    const ok = (a) => accounts().some((x) => x.id === a?.id);
    const last = st.account(s.settings.lastAccountId);
    if (state.accountId && ok(st.account(state.accountId))) return;
    if (state.mode === "income") state.accountId = (accounts().find((a) => a.type === "debit") || accounts()[0])?.id;
    else state.accountId = ok(last) ? last.id : accounts()[0]?.id;
  };

  const modes = [["expense", "Gasto"], ["income", "Ingreso"], ...(p ? [["house", "Casa"]] : [])];
  const body = `
    <div class="qa">
      <div class="qa-modes">${modes.map(([v, l]) => `<button type="button" data-mode="${v}">${l}</button>`).join("")}<button type="button" data-more>${icon("ellipsis")}</button></div>
      <div class="qa-amount"><span class="cur">$</span><span class="val" id="qaVal">0</span></div>
      <div class="qa-expr" id="qaExpr"></div>
      <label class="qa-concept"><span id="qaLogo">${icon("pencil")}</span><input name="concept" placeholder="¿En qué? (opcional)" value="${esc(preset.concept || "")}" autocomplete="off"/></label>
      <div class="qa-row" id="qaPayer"></div>
      <div class="qa-row scroll" id="qaAcc"></div>
      <div class="qa-row scroll" id="qaCat"></div>
      <div class="qa-opts" id="qaOpts"></div>
      <div class="keypad">${KEYS.map((k) =>
        k === "back" ? `<button type="button" data-k="back" aria-label="Borrar">${icon("delete")}</button>`
        : k === "save" ? `<button type="button" data-k="save" class="save">${icon("check")}<span>Guardar</span></button>`
        : `<button type="button" data-k="${k}">${k === "+" ? icon("plus") : k}</button>`).join("")}</div>
    </div>`;

  const form = openSheet({ title: "Registrar", body, wide: false, onMount: () => {} });
  form.classList.add("quick-sheet");
  const $ = (q) => form.querySelector(q);

  const paint = () => {
    // pestañas
    form.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === state.mode));
    // monto
    const v = parseAmount(state.expr);
    $("#qaVal").textContent = state.expr ? (Number.isFinite(v) ? money(v).replace("$", "") : state.expr) : "0";
    $("#qaVal").classList.toggle("empty", !state.expr);
    $("#qaExpr").textContent = /[+]/.test(state.expr) ? state.expr.replace(/\+/g, " + ") : "";
    // quién pagó (casa)
    const payer = $("#qaPayer");
    if (state.mode === "house") {
      const opts = [["me", "Pagué yo"], ["partner", `Pagó ${p.name}`], ...(fundId ? [["fund", "Del fondo"]] : [])];
      payer.innerHTML = opts.map(([v2, l]) => `<button type="button" class="pill-btn ${state.payer === v2 ? "on" : ""}" data-payer="${v2}">${esc(l)}</button>`).join("");
      payer.classList.remove("hidden");
    } else payer.classList.add("hidden");
    // cuentas
    const accWrap = $("#qaAcc");
    const showAcc = !(state.mode === "house" && state.payer !== "me");
    accWrap.classList.toggle("hidden", !showAcc);
    if (showAcc) {
      pickDefaultAccount();
      accWrap.innerHTML = accounts().map((a) => {
        const nb = naturalBalance(a, C.acc[a.id]);
        return `<button type="button" class="acc-pill ${state.accountId === a.id ? "on" : ""}" data-acc="${a.id}">${accountTile(a, "sm")}<span><b>${esc(a.name)}</b><small>${a.type === "credit" ? "debe " : ""}${money(nb)}</small></span></button>`;
      }).join("");
    }
    // categorías
    const cats = categoriesByUse(s, state.mode === "income" ? "income" : "expense");
    if (state.mode === "house" && !state.categoryId) state.categoryId = (cats.find((c) => c.household) || cats[0])?.id;
    $("#qaCat").innerHTML = cats.map((c) => `<button type="button" class="cat-pill ${state.categoryId === c.id ? "on" : ""}" data-cat="${c.id}">${categoryTile(c, "sm")}<span>${esc(c.name)}</span></button>`).join("");
    // opciones
    const myPct = Number(s.settings.fund.myPct) || 0;
    const partnerPct = Number(s.settings.partnerPct) || 0;
    $("#qaOpts").innerHTML = `
      ${state.mode === "expense" && p ? `<button type="button" class="pill-btn ${state.split ? "on" : ""}" data-split>${icon("users")} ${state.split ? (state.split === 50 ? `50/50 con ${esc(p.name)}` : `${esc(p.name)} paga ${state.split}%`) : `Dividir con ${esc(p.name)}`}</button>` : ""}
      ${state.mode === "house" ? `<span class="qa-note">${state.payer === "fund" ? "Sale del fondo común" : `Tú ${myPct}% · ${esc(p.name)} ${100 - myPct}%`}</span>` : ""}
      <label class="pill-btn date-pill">${icon("calendar")} <span>${fmtDate(state.date)}</span><input type="date" name="qaDate" value="${state.date}"/></label>
      <button type="button" class="pill-btn ghost" data-full>Más opciones</button>`;
  };

  const updLogo = () => {
    const b = brandFor(form.elements.concept.value);
    $("#qaLogo").innerHTML = b ? logo(b, "xs") : icon("pencil");
  };

  const press = (k) => {
    if (k === "save") return save();
    if (k === "back") state.expr = state.expr.slice(0, -1);
    else if (k === "+") { if (state.expr && !/[+.]$/.test(state.expr)) state.expr += "+"; }
    else if (k === ".") { const last = state.expr.split("+").pop(); if (!last.includes(".")) state.expr += state.expr && !/\+$/.test(state.expr) ? "." : "0."; }
    else {
      const last = state.expr.split("+").pop();
      if (last.includes(".") && last.split(".")[1].length >= 2) return;
      if (state.expr.length > 18) return;
      state.expr = (state.expr === "0" ? "" : state.expr) + k;
    }
    paint();
  };

  function save() {
    const amount = parseAmount(state.expr.replace(/\+$/, ""));
    if (!(amount > 0)) { toast("Escribe el monto"); $(".qa-amount").classList.add("shake"); setTimeout(() => $(".qa-amount").classList.remove("shake"), 400); return; }
    const concept = form.elements.concept.value.trim();
    const base = { id: uid(), concept, date: state.date, categoryId: state.categoryId || "", shares: [], createdAt: Date.now() };
    const pid = s.settings.partnerId;
    if (state.mode === "income") {
      if (!state.accountId) return toast("Elige la cuenta");
      st.upsert("tx", { ...base, type: "income", amount, accountId: state.accountId, categoryId: state.categoryId || "i_trabajo", personId: "" });
    } else if (state.mode === "house") {
      const myPct = Number(s.settings.fund.myPct) || 0;
      if (state.payer === "partner") {
        st.upsert("tx", { ...base, type: "debt", dir: "iOwe", personId: pid, amount: round2((amount * myPct) / 100), total: amount, myPct, accountId: "", house: true });
      } else if (state.payer === "fund") {
        st.upsert("tx", { ...base, type: "expense", amount, accountId: fundId, house: true });
      } else {
        if (!state.accountId) return toast("Elige con qué pagaste");
        const pct = 100 - myPct;
        st.upsert("tx", { ...base, type: "expense", amount, accountId: state.accountId, house: true, shares: pct > 0 ? [{ personId: pid, pct, amount: round2((amount * pct) / 100) }] : [] });
      }
    } else {
      if (!state.accountId) return toast("Elige con qué pagaste");
      const pct = state.split;
      st.upsert("tx", { ...base, type: "expense", amount, accountId: state.accountId, shares: pct && pid ? [{ personId: pid, pct, amount: round2((amount * pct) / 100) }] : [] });
    }
    if (state.accountId && state.mode !== "income") s.settings.lastAccountId = state.accountId;
    st.save();
    closeSheet();
    refresh();
    const lim = state.categoryId && state.mode !== "income" ? limitsStatus(s, monthKey(state.date)).rows.find((x) => x.id === state.categoryId) : null;
    const cname = s.categories.find((c) => c.id === state.categoryId)?.name;
    toast(lim ? (lim.remaining >= 0 ? `Guardado · te quedan ${money(lim.remaining)} de ${cname}` : `Guardado · te pasaste ${money(-lim.remaining)} en ${cname}`) : `${money(amount)} guardado`);
  }

  form.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-k]");
    if (!t) return;
    if (t.dataset.k) return press(t.dataset.k);
    if (t.dataset.mode) { state.mode = t.dataset.mode; state.categoryId = null; state.accountId = null; return paint(); }
    if (t.dataset.payer) { state.payer = t.dataset.payer; return paint(); }
    if (t.dataset.acc) { state.accountId = t.dataset.acc; return paint(); }
    if (t.dataset.cat) { state.categoryId = state.categoryId === t.dataset.cat ? null : t.dataset.cat; return paint(); }
    if (t.dataset.split !== undefined) { const pp = Number(s.settings.partnerPct) || 40; state.split = state.split === 0 ? pp : state.split === pp && pp !== 50 ? 50 : 0; return paint(); }
    if (t.dataset.more !== undefined) { closeSheet(true); return openFull("menu"); }
    if (t.dataset.full !== undefined) {
      const amount = parseAmount(state.expr);
      closeSheet(true);
      return openFull(state.mode, { amount: Number.isFinite(amount) ? amount : "", concept: form.elements.concept.value, accountId: state.accountId, categoryId: state.categoryId, date: state.date, split: state.split === 50 ? "half" : state.split ? "partner" : undefined, house: state.mode === "house", payer: state.payer });
    }
  });
  form.addEventListener("change", (e) => { if (e.target.name === "qaDate") { state.date = e.target.value || today(); paint(); } });
  form.elements.concept.addEventListener("input", updLogo);
  // teclado físico (escritorio)
  const onKey = (e) => {
    if (!document.body.contains(form)) return document.removeEventListener("keydown", onKey);
    if (e.target === form.elements.concept) { if (e.key === "Enter") { e.preventDefault(); save(); } return; }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === "." || e.key === ",") press(".");
    else if (e.key === "+") press("+");
    else if (e.key === "Backspace") press("back");
    else if (e.key === "Enter") { e.preventDefault(); save(); }
    else return;
    e.preventDefault();
  };
  document.addEventListener("keydown", onKey);
  paint();
  updLogo();
}
