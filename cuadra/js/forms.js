// ================= Formularios (hojas inferiores) =================
import * as st from "./store.js";
import { ACCOUNT_TYPES, uid } from "./store.js";
import { esc, money, parseAmount, round2, today, addMonths, fmtDate, fmtRange } from "./format.js";
import { openSheet, closeSheet, fieldError, field, amountInput, textInput, numInput, dateInput, select, chips, segmented, toggle, toast, kv } from "./ui.js";
import { compute, msiInfo, cardInfo, nextDayOfMonth, naturalBalance, planInfo, corteSummary, EVENT_LABEL } from "./calc.js";
import { icon } from "./logos.js";
import { quickAdd, accountTile } from "./quick.js";

let refresh = () => {};
export const bindRefresh = (fn) => (refresh = fn);
const S = () => st.state();
const done = (msg) => { refresh(); if (msg) toast(msg); };
const partnerName = () => st.partner()?.name || "tu pareja";

// ---------- helpers ----------
function wireConditional(form) {
  const val = (name) => {
    const els = form.elements[name];
    if (!els) return form.dataset[name] ?? "";
    if (els instanceof RadioNodeList) return els.value;
    if (els.type === "checkbox") return els.checked ? "on" : "";
    return els.value;
  };
  const apply = () => {
    form.querySelectorAll("[data-show-if]").forEach((el) => {
      const ok = el.dataset.showIf.split("&").every((cond) => {
        const [name, vals] = cond.split("=");
        return vals.split("|").includes(val(name));
      });
      el.classList.toggle("hidden", !ok);
    });
  };
  form.addEventListener("change", apply);
  form.addEventListener("input", apply);
  form._apply = apply;
  apply();
}

function accountOptions(filter = () => true) {
  const s = S();
  const C = compute(s);
  return s.accounts
    .filter((a) => !a.archived && filter(a))
    .map((a) => {
      const nb = naturalBalance(a, C.acc[a.id]);
      return { value: a.id, label: a.name, icon: accountTile(a, "xs"), sub: a.type === "credit" ? `debe ${money(nb)}` : money(nb), attrs: `data-type="${a.type}"` };
    });
}
function defaultAccountId(filter = () => true) {
  const s = S();
  const last = st.account(s.settings.lastAccountId);
  if (last && !last.archived && filter(last)) return last.id;
  return (s.accounts.find((a) => !a.archived && a.type === "debit" && filter(a)) || s.accounts.find((a) => !a.archived && filter(a)))?.id;
}
const categoryOptions = (kind) => S().categories.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.name, icon: c.ico ? icon(c.ico) : c.icon }));
const peopleOptions = (withNone) => [
  ...(withNone ? [{ value: "", label: withNone }] : []),
  ...S().people.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
];
function noAccountsGuard() {
  if (S().accounts.some((a) => !a.archived)) return false;
  toast("Primero agrega una cuenta (Cuentas → ＋)");
  location.hash = "#/cuentas";
  return true;
}
const parsePct = (v, def) => {
  const n = parseAmount(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : def;
};

// ---------- División de gastos ----------
function splitSection({ mode = "none", pct = "", personId = "" } = {}) {
  const s = S();
  const p = st.partner();
  const opts = [{ value: "none", label: "Solo yo" }];
  if (p) opts.push({ value: "partner", label: `Con ${p.name}` }, { value: "half", label: "50/50" }, { value: "partner100", label: `100% ${p.name}` });
  opts.push({ value: "other", label: "Otra persona" });
  return `
    <div class="field"><span class="lbl">¿Se divide?</span>${segmented("split", opts, mode)}</div>
    <div class="row2" data-show-if="split=partner|other">
      ${field("% que le toca", numInput("splitPct", pct || (mode === "other" ? 100 : s.settings.partnerPct), "40"), "", "small")}
      <div data-show-if="split=other">${field("Persona", select("splitPerson", peopleOptions("Elige…"), personId))}</div>
    </div>`;
}
function readSplit(fd) {
  const s = S();
  const mode = fd.get("split") || "none";
  const pid = s.settings.partnerId;
  if (mode === "none") return [];
  if (mode === "half") return [{ personId: pid, pct: 50 }];
  if (mode === "partner100") return [{ personId: pid, pct: 100 }];
  if (mode === "partner") return [{ personId: pid, pct: parsePct(fd.get("splitPct"), s.settings.partnerPct) }];
  if (mode === "other") {
    const personId = fd.get("splitPerson");
    return personId ? [{ personId, pct: parsePct(fd.get("splitPct"), 100) }] : null;
  }
  return [];
}
function deriveSplit(shares, amount) {
  const pid = S().settings.partnerId;
  if (!shares?.length) return { mode: "none" };
  const sh = shares[0];
  const pct = sh.pct ?? (amount ? round2((sh.amount / amount) * 100) : 0);
  if (sh.personId === pid) {
    if (Math.abs(pct - 100) < 0.01) return { mode: "partner100", pct };
    if (Math.abs(pct - 50) < 0.01) return { mode: "half", pct };
    return { mode: "partner", pct };
  }
  return { mode: "other", pct, personId: sh.personId };
}

// ================= GASTO =================
export function expenseForm(t = null, preset = {}) {
  if (noAccountsGuard()) return;
  const s = S();
  const v = t || { date: preset.date || today(), accountId: preset.accountId || defaultAccountId(), categoryId: preset.categoryId || "", shares: [], amount: preset.amount, concept: preset.concept, house: !!preset.house };
  const houseSplit = { mode: "partner", pct: 100 - (Number(s.settings.fund.myPct) || 0) };
  const split = preset.split ? { mode: preset.split } : !t && preset.house ? houseSplit : deriveSplit(v.shares, v.amount);
  const months = [3, 6, 9, 12, 18, 24].map((n) => ({ value: n, label: `${n}` }));
  openSheet({
    title: t ? "Editar gasto" : "Nuevo gasto",
    body: `
      ${amountInput("amount", v.amount)}
      ${field("Concepto", textInput("concept", v.concept, "Walmart, gasolina, cena…"))}
      <div class="field"><span class="lbl">Pagado con</span>${chips("accountId", accountOptions(), v.accountId, { cls: "scroll" })}</div>
      <div class="field"><span class="lbl">Categoría</span>${chips("categoryId", categoryOptions("expense"), v.categoryId, { cls: "wrap small" })}</div>
      ${st.partner() ? toggle("house", "Gasto de casa", !!v.house, "Se reparte según el % de la casa") : ""}
      ${splitSection(split)}
      ${field("Fecha", dateInput("date", v.date))}
      ${!t ? `<div data-show-if="acctype=credit" class="msi-box">
        ${toggle("isMsi", "Compra a meses sin intereses", false)}
        <div data-show-if="isMsi=on">
          <div class="field"><span class="lbl">Meses</span>${chips("months", months, 12, { cls: "seg" })}</div>
          ${field("Primera mensualidad", dateInput("firstDate", ""), "Vacío = en el siguiente corte de la tarjeta.")}
        </div>
      </div>` : ""}
      ${toggle("extra", "Gasto extraordinario", !!v.extra, "Viaje grande, boda, reparación… no cuenta en tu promedio")}
      ${toggle("excluded", "No es gasto mío", !!v.excluded, "Mitad de un bono que compartes, o algo que paga Ad Center")}
      ${field("Nota", textInput("note", v.note, "Opcional"))}`,
    extraButtons: t ? [{ label: "Eliminar", cls: "danger", onClick: () => delTx(t) }] : [],
    onMount: (form) => {
      const setType = () => {
        const sel = form.querySelector('input[name="accountId"]:checked');
        form.dataset.acctype = sel?.dataset.type || "";
        if (!t && sel?.dataset.type === "fund" && form.elements.split) form.elements.split.value = "none";
      };
      form.addEventListener("change", (e) => e.target.name === "accountId" && (setType(), form._apply()));
      form.elements.house?.addEventListener("change", () => {
        if (!form.elements.house.checked) return;
        form.elements.split.value = "partner";
        form.elements.splitPct.value = houseSplit.pct;
        form._apply();
      });
      setType();
      wireConditional(form);
    },
    onSubmit: (form, fd) => {
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe un monto válido");
      const accountId = fd.get("accountId");
      if (!accountId) return toast("Elige con qué pagaste"), false;
      const shares = readSplit(fd);
      if (shares === null) return toast("Elige la persona"), false;
      s.settings.lastAccountId = accountId;
      const base = { concept: fd.get("concept").trim(), categoryId: fd.get("categoryId") || "", date: fd.get("date") || today(), note: fd.get("note").trim(), house: !!fd.get("house") || accountId === s.settings.fund.accountId, extra: !!fd.get("extra"), excluded: !!fd.get("excluded"), excludedReason: fd.get("excluded") ? (t?.excludedReason || "No es gasto mío") : undefined };
      if (fd.get("isMsi") && st.account(accountId)?.type === "credit") {
        const acc = st.account(accountId);
        const m = {
          id: uid(), accountId, ...base, total: amount, months: Number(fd.get("months")) || 12,
          firstDate: fd.get("firstDate") || nextDayOfMonth(Number(acc.cutoffDay), base.date) || addMonths(base.date, 1),
          shares: shares.map((x) => ({ personId: x.personId, pct: x.pct })), offset: 0, extraPaid: 0, createdAt: Date.now(),
        };
        st.upsert("msi", m);
        return done("Compra a MSI guardada");
      }
      st.upsert("tx", {
        ...(t || {}), id: t?.id || uid(), type: "expense", amount, accountId, ...base,
        shares: shares.map((x) => ({ personId: x.personId, pct: x.pct, amount: round2((amount * x.pct) / 100) })),
        createdAt: t?.createdAt || Date.now(),
      });
      done(t ? "Gasto actualizado" : "Gasto guardado");
    },
  });
}

// ================= INGRESO / BONO / APORTACIÓN =================
export function incomeForm(t = null, preset = {}) {
  if (noAccountsGuard()) return;
  const s = S();
  const fundId = s.settings.fund.accountId;
  const v = t || { date: preset.date || today(), accountId: preset.accountId || defaultAccountId((a) => a.type !== "credit"), categoryId: preset.categoryId || "i_trabajo", personId: preset.personId || "", amount: preset.amount, concept: preset.concept };
  openSheet({
    title: t ? "Editar ingreso" : preset.title || "Nuevo ingreso",
    body: `
      ${amountInput("amount", v.amount)}
      ${field("Concepto", textInput("concept", v.concept, "Sueldo, cliente, bono Amex…"))}
      <div class="field"><span class="lbl">Entra a</span>${chips("accountId", accountOptions(), v.accountId, { cls: "scroll" })}</div>
      <div class="field"><span class="lbl">Tipo</span>${chips("categoryId", categoryOptions("income"), v.categoryId, { cls: "wrap small" })}</div>
      <div data-show-if="categoryId=i_aporte|i_reemb">${field("¿De parte de quién?", select("personId", peopleOptions("Yo"), v.personId))}</div>
      ${field("Fecha", dateInput("date", v.date))}
      <p class="hint" data-show-if="categoryId=i_bono">Un bono en una tarjeta de crédito reduce su deuda.</p>
      ${!t ? `<div data-show-if="categoryId=i_bono">${toggle("share", "Le paso la mitad a quien referí", false)}
        <div data-show-if="share=on">
          <div class="row2">${field("¿A quién?", textInput("shareName", "", "Jonny, Natalia…"))}${field("Monto", numInput("shareAmt", "", "Mitad"))}</div>
          <div class="field"><span class="lbl">Se lo pasas desde</span>${chips("shareAcc", accountOptions((a) => a.type !== "credit"), defaultAccountId((a) => a.type === "debit") || "", { cls: "scroll" })}</div>
        </div></div>` : ""}
      <p class="hint" data-show-if="categoryId=i_aporte">Las aportaciones al fondo no cuentan como tu ingreso.</p>`,
    extraButtons: t ? [{ label: "Eliminar", cls: "danger", onClick: () => delTx(t) }] : [],
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe un monto válido");
      const accountId = fd.get("accountId");
      if (!accountId) return toast("Elige la cuenta"), false;
      const categoryId = fd.get("categoryId") || "i_otro";
      st.upsert("tx", {
        ...(t || {}), id: t?.id || uid(), type: "income", amount, accountId, categoryId,
        concept: fd.get("concept").trim(), date: fd.get("date") || today(),
        personId: ["i_aporte", "i_reemb"].includes(categoryId) ? fd.get("personId") || "" : "",
        shares: [], createdAt: t?.createdAt || Date.now(),
      });
      if (!t && categoryId === "i_bono" && fd.get("share")) {
        const half = parseAmount(fd.get("shareAmt") || "") || round2(amount / 2);
        st.upsert("tx", { id: uid(), type: "expense", amount: half, accountId: fd.get("shareAcc") || defaultAccountId((a) => a.type === "debit"), categoryId: "",
          concept: `Mitad bono${fd.get("shareName") ? " — " + fd.get("shareName").trim() : ""}`, date: fd.get("date") || today(), excluded: true, bonusShare: true,
          excludedReason: "Mitad del bono Amex que le pasaste", shares: [], createdAt: Date.now() + 1 });
      }
      done(accountId === fundId && categoryId === "i_aporte" ? "Aportación registrada" : "Ingreso guardado");
    },
  });
}

// ================= TRANSFERENCIA / PAGO A TARJETA =================
export function transferForm(t = null, preset = {}) {
  if (noAccountsGuard()) return;
  const s = S();
  const payment = preset.payment || (t && st.account(t.toAccountId)?.type === "credit");
  const v = t || {
    date: today(),
    accountId: preset.accountId || defaultAccountId((a) => a.type !== "credit"),
    toAccountId: preset.toAccountId || (payment ? s.accounts.find((a) => a.type === "credit" && !a.archived)?.id : ""),
    amount: preset.amount,
  };
  openSheet({
    title: t ? "Editar movimiento" : payment ? "Pago a tarjeta" : preset.title || "Transferencia",
    body: `
      ${amountInput("amount", v.amount)}
      <div class="field"><span class="lbl">Sale de</span>${chips("accountId", accountOptions(), v.accountId, { cls: "scroll" })}</div>
      <div class="field"><span class="lbl">${payment ? "Tarjeta que pagas" : "Llega a"}</span>${chips("toAccountId", accountOptions(payment ? (a) => a.type === "credit" : undefined), v.toAccountId, { cls: "scroll" })}</div>
      <div id="payQuick" class="quick"></div>
      ${field("Concepto", textInput("concept", v.concept, payment ? "Pago del mes" : "Retiro, apartado…"))}
      ${field("Fecha", dateInput("date", v.date))}`,
    extraButtons: t ? [{ label: "Eliminar", cls: "danger", onClick: () => delTx(t) }] : [],
    onMount: (form) => {
      const q = form.querySelector("#payQuick");
      const upd = () => {
        const id = form.querySelector('input[name="toAccountId"]:checked')?.value;
        const a = st.account(id);
        if (!a || a.type !== "credit") { q.innerHTML = ""; return; }
        const C = compute(S());
        const ci = cardInfo(S(), a, C);
        const opts = [["Deuda total", ci.debt]];
        if (ci.msiRemaining > 0) opts.push(["Sin MSI + mensualidades", round2(ci.debtNoMsi + ci.msiMonthly)]);
        q.innerHTML = opts.filter(([, n]) => n > 0).map(([l, n]) => `<button type="button" class="pill" data-fill="${n}">${l}: ${money(n)}</button>`).join("");
      };
      form.addEventListener("change", (e) => e.target.name === "toAccountId" && upd());
      q.addEventListener("click", (e) => { const b = e.target.closest("[data-fill]"); if (b) form.elements.amount.value = b.dataset.fill; });
      upd();
    },
    onSubmit: (form, fd) => {
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe un monto válido");
      const a = fd.get("accountId"), b = fd.get("toAccountId");
      if (!a || !b) return toast("Elige ambas cuentas"), false;
      if (a === b) return toast("Las cuentas deben ser distintas"), false;
      st.upsert("tx", { ...(t || {}), id: t?.id || uid(), type: "transfer", amount, accountId: a, toAccountId: b, concept: fd.get("concept").trim(), date: fd.get("date") || today(), shares: [], createdAt: t?.createdAt || Date.now() });
      done(st.account(b)?.type === "credit" ? "Pago a tarjeta registrado" : "Transferencia guardada");
    },
  });
}

// ================= PRÉSTAMOS Y DEUDAS CON PERSONAS =================
const PERSON_KINDS = [
  { value: "lend", label: "Le presté" },
  { value: "collect", label: "Me pagó" },
  { value: "owesMe", label: "Me debe" },
  { value: "iOwe", label: "Le debo" },
  { value: "borrow", label: "Me prestó" },
  { value: "repay", label: "Le pagué" },
];
export function personTxForm(t = null, preset = {}) {
  const s = S();
  if (!s.people.length) { toast("Primero agrega a la persona"); return personForm(); }
  const kind0 = t ? (t.type === "debt" ? t.dir || "owesMe" : t.type) : preset.kind || "lend";
  const v = t || { date: today(), personId: preset.personId || s.people.find((p) => !p.archived)?.id, accountId: preset.accountId ?? defaultAccountId((a) => a.type !== "credit") };
  openSheet({
    title: t ? "Editar movimiento" : "Préstamo o deuda",
    body: `
      ${field("Persona", select("personId", peopleOptions(), v.personId))}
      <div class="field"><span class="lbl">¿Qué pasó?</span>${segmented("kind", PERSON_KINDS, kind0)}</div>
      ${amountInput("amount", v.amount, { autofocus: !t })}
      ${field("Concepto", textInput("concept", v.concept, "Gasolina, préstamo, pieza del carro…"))}
      <div class="field" data-show-if="kind=lend|collect|borrow|repay"><span class="lbl">Cuenta</span>${chips("accountId", [{ value: "", label: "Sin cuenta" }, ...accountOptions()], v.accountId ?? "", { cls: "scroll" })}</div>
      <div data-show-if="kind=collect&hasplan=yes">${toggle("planPayment", "Cuenta como abono a su plan de pagos", t ? !!t.planPayment : true)}</div>
      ${field("Fecha", dateInput("date", v.date))}
      <p class="hint" data-show-if="kind=owesMe|iOwe">Solo registra la deuda; no mueve dinero de tus cuentas.</p>`,
    extraButtons: t ? [{ label: "Eliminar", cls: "danger", onClick: () => delTx(t) }] : [],
    onMount: (form) => {
      const upd = () => { form.dataset.hasplan = st.person(form.elements.personId.value)?.plan ? "yes" : "no"; };
      form.elements.personId.addEventListener("change", () => (upd(), form._apply()));
      upd();
      wireConditional(form);
    },
    onSubmit: (form, fd) => {
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe un monto válido");
      const kind = fd.get("kind");
      const isDebt = kind === "owesMe" || kind === "iOwe";
      const tx = {
        ...(t || {}), id: t?.id || uid(), personId: fd.get("personId"), amount,
        type: isDebt ? "debt" : kind, dir: isDebt ? kind : undefined,
        accountId: isDebt ? "" : fd.get("accountId") || "",
        planPayment: kind === "collect" && !!fd.get("planPayment") && !!st.person(fd.get("personId"))?.plan,
        concept: fd.get("concept").trim(), date: fd.get("date") || today(), shares: t?.shares || [], createdAt: t?.createdAt || Date.now(),
      };
      if (!isDebt) delete tx.dir;
      st.upsert("tx", tx);
      done("Guardado");
    },
  });
}

// ================= "MI PAREJA PAGÓ ALGO" (te toca una parte) =================
export function partnerPaidForm(t = null, preset = {}) {
  const s = S();
  const p = st.partner();
  if (!p) { toast("Configura a tu pareja en Más → Ajustes"); return; }
  const myPctDef = preset.house || t?.house ? Number(s.settings.fund.myPct) || 0 : 100 - (Number(s.settings.partnerPct) || 0);
  const total = t?.total ?? preset.amount ?? "";
  const myPct = t?.myPct ?? myPctDef;
  openSheet({
    title: t ? "Editar" : `${p.name} pagó algo`,
    body: `
      <p class="hint">Registra lo que pagó ${esc(p.name)} con su dinero; a ti te toca una parte.</p>
      ${field("Total que pagó", amountInput("total", total))}
      ${field("Concepto", textInput("concept", t?.concept ?? preset.concept, "Súper, cena, Uber…"))}
      <div class="row2">
        ${field("Tu parte (%)", numInput("myPct", myPct))}
        ${field("Fecha", dateInput("date", t?.date || preset.date || today()))}
      </div>
      ${toggle("house", "Gasto de casa", !!(t?.house ?? preset.house))}
      <div class="field"><span class="lbl">Categoría</span>${chips("categoryId", categoryOptions("expense"), t?.categoryId || preset.categoryId || "", { cls: "wrap small" })}</div>
      <div class="calc-line" id="ppCalc"></div>`,
    extraButtons: t ? [{ label: "Eliminar", cls: "danger", onClick: () => delTx(t) }] : [],
    onMount: (form) => {
      const out = form.querySelector("#ppCalc");
      const upd = () => {
        const tot = parseAmount(form.elements.total.value), pct = parsePct(form.elements.myPct.value, myPctDef);
        out.innerHTML = tot > 0 ? `Le debes a ${esc(p.name)}: <b>${money((tot * pct) / 100)}</b>` : "";
      };
      form.addEventListener("input", upd);
      upd();
    },
    onSubmit: (form, fd) => {
      const tot = parseAmount(fd.get("total"));
      if (!(tot > 0)) return fieldError(form, "total", "Escribe el total");
      const pct = parsePct(fd.get("myPct"), myPctDef);
      st.upsert("tx", {
        ...(t || {}), id: t?.id || uid(), type: "debt", dir: "iOwe", personId: p.id,
        amount: round2((tot * pct) / 100), total: tot, myPct: pct, categoryId: fd.get("categoryId") || "", house: !!fd.get("house"),
        concept: fd.get("concept").trim(), date: fd.get("date") || today(), accountId: "", shares: [], createdAt: t?.createdAt || Date.now(),
      });
      done("Registrado");
    },
  });
}

// ================= AJUSTE MANUAL =================
export function adjustForm(t = null, preset = {}) {
  if (noAccountsGuard()) return;
  const v = t || { date: today(), accountId: preset.accountId || defaultAccountId() };
  const a0 = st.account(v.accountId);
  const sign0 = t ? (a0?.type === "credit" ? (t.amount < 0 ? "up" : "down") : t.amount >= 0 ? "up" : "down") : "up";
  openSheet({
    title: t ? "Editar ajuste" : "Ajuste de saldo",
    body: `
      <div class="field"><span class="lbl">Cuenta</span>${chips("accountId", accountOptions(), v.accountId, { cls: "scroll" })}</div>
      <div class="field"><span class="lbl">Dirección</span>${segmented("sign", [{ value: "up", label: "Aumentar" }, { value: "down", label: "Disminuir" }], sign0)}</div>
      <p class="hint">En tarjetas de crédito, “aumentar” sube la deuda.</p>
      ${amountInput("amount", t ? Math.abs(t.amount) : "", { autofocus: !t })}
      ${field("Motivo", textInput("concept", v.concept || "", "Comisión, intereses, redondeo…"))}
      ${field("Fecha", dateInput("date", v.date))}
      <p class="hint">Para igualar el saldo con tu banco usa mejor <b>Cuadrar</b>.</p>`,
    extraButtons: t ? [{ label: "Eliminar", cls: "danger", onClick: () => delTx(t) }] : [],
    onSubmit: (form, fd) => {
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe un monto válido");
      const a = st.account(fd.get("accountId"));
      if (!a) return toast("Elige la cuenta"), false;
      const up = fd.get("sign") === "up";
      const signed = a.type === "credit" ? (up ? -amount : amount) : up ? amount : -amount;
      st.upsert("tx", { ...(t || {}), id: t?.id || uid(), type: "adjust", accountId: a.id, amount: signed, concept: fd.get("concept").trim() || "Ajuste", date: fd.get("date") || today(), shares: [], createdAt: t?.createdAt || Date.now() });
      done("Ajuste guardado");
    },
  });
}

// ================= CUADRAR UNA CUENTA =================
const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
export function reconcileForm(accountId) {
  const s = S();
  const a = st.account(accountId);
  if (!a) return;
  const C = compute(s);
  const appBal = C.acc[a.id];
  const credit = a.type === "credit";
  const appNat = naturalBalance(a, appBal);
  openSheet({
    title: `Cuadrar ${a.name}`,
    body: `
      <div class="recon-head">
        <div><small>Según la app</small><b>${money(appNat)}</b><small>${credit ? "deuda" : "saldo"}</small></div>
        ${a.lastReconciled ? `<div><small>Último cuadre</small><b>${fmtDate(a.lastReconciled)}</b></div>` : ""}
      </div>
      ${credit && Number(a.limit) ? `<div class="field"><span class="lbl">¿Qué ves en tu banco?</span>${segmented("mode", [{ value: "debt", label: "Deuda total" }, { value: "avail", label: "Crédito disponible" }], "debt")}</div>` : ""}
      ${a.type === "cash" ? `<details class="counter" open><summary>Contar billetes y monedas</summary><div class="denoms">${DENOMS.map((d) => `<label><span>$${d}</span><input inputmode="numeric" data-denom="${d}" placeholder="0"/></label>`).join("")}</div></details>` : ""}
      ${field(credit ? "Lo que dice tu banco" : "Saldo real", amountInput("real", ""))}
      <div class="recon-diff" id="rDiff"></div>`,
    submitLabel: "Guardar cuadre",
    onMount: (form) => {
      const out = form.querySelector("#rDiff");
      const realBal = () => {
        const v = parseAmount(form.elements.real.value);
        if (!Number.isFinite(v)) return null;
        if (!credit) return v;
        const mode = form.elements.mode?.value || "debt";
        return mode === "avail" ? -(Number(a.limit) - v) : -v;
      };
      const upd = () => {
        const r = realBal();
        if (r == null) { out.innerHTML = ""; return; }
        const diff = round2(r - appBal);
        out.innerHTML = Math.abs(diff) < 0.01
          ? `<span class="ok">✓ ¡Cuadra perfecto!</span>`
          : `Diferencia: <b class="${diff > 0 ? "pos" : "neg"}">${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}</b><small>${credit ? (diff > 0 ? "Debes menos de lo que la app cree" : "Debes más de lo que la app cree — ¿falta registrar algún gasto?") : diff > 0 ? "Tienes más de lo que la app cree" : "Tienes menos — ¿falta registrar algún gasto?"}</small>`;
      };
      form.addEventListener("input", (e) => {
        if (e.target.dataset.denom !== undefined) {
          const tot = [...form.querySelectorAll("[data-denom]")].reduce((s2, i) => s2 + Number(i.dataset.denom) * (parseInt(i.value, 10) || 0), 0);
          form.elements.real.value = round2(tot);
        }
        upd();
      });
      form.addEventListener("change", upd);
      form._realBal = realBal;
    },
    onSubmit: (form) => {
      const r = form._realBal();
      if (r == null) return fieldError(form, "real", "Escribe el saldo real");
      const diff = round2(r - appBal);
      if (Math.abs(diff) >= 0.01) {
        st.upsert("tx", { id: uid(), type: "adjust", accountId: a.id, amount: diff, concept: "Ajuste de cuadre", reconcile: true, date: today(), shares: [], createdAt: Date.now() });
      }
      a.lastReconciled = today();
      a.lastReconciledBalance = r;
      st.upsert("accounts", a);
      done(Math.abs(diff) < 0.01 ? "✓ Cuenta cuadrada" : `Ajuste de ${money(diff)} registrado`);
    },
  });
}

// ================= COMPRA A MSI =================
export function msiForm(m = null, preset = {}) {
  const s = S();
  if (!s.accounts.some((a) => a.type === "credit" && !a.archived)) { toast("Agrega primero una tarjeta de crédito"); return accountForm(null, { type: "credit" }); }
  const v = m || { date: today(), accountId: preset.accountId || s.accounts.find((a) => a.type === "credit" && !a.archived)?.id, months: 12, shares: [] };
  const split = deriveSplit((v.shares || []).map((x) => ({ ...x })), 0);
  const info = m ? msiInfo(m) : null;
  openSheet({
    title: m ? "Compra a MSI" : "Nueva compra a MSI",
    body: `
      ${info ? `<div class="recon-head"><div><small>Pagadas</small><b>${info.paid}/${info.months}</b></div><div><small>Restante</small><b>${money(info.remaining)}</b></div><div><small>Mensualidad</small><b>${money(info.monthly)}</b></div></div>` : ""}
      ${field("Total de la compra", amountInput("total", v.total, { autofocus: !m }))}
      ${field("Concepto", textInput("concept", v.concept, "iPhone, lavadora, seguro…"))}
      <div class="field"><span class="lbl">Tarjeta</span>${chips("accountId", accountOptions((a) => a.type === "credit"), v.accountId, { cls: "scroll" })}</div>
      <div class="row2">
        ${field("Meses", select("months", [3, 6, 9, 10, 12, 13, 15, 18, 20, 24, 36, 48].map((n) => ({ value: n, label: `${n} meses` })), v.months))}
        ${field("Fecha de compra", dateInput("date", v.date))}
      </div>
      ${field("Primera mensualidad", dateInput("firstDate", v.firstDate || ""), "Vacío = en el siguiente corte. Con esto la app sabe sola en qué mes vas.")}
      <div class="field"><span class="lbl">Categoría</span>${chips("categoryId", categoryOptions("expense"), v.categoryId || "", { cls: "wrap small" })}</div>
      ${splitSection(split)}
      <details class="adv" ${m && (m.offset || m.extraPaid) ? "open" : ""}><summary>Ajustes avanzados</summary>
        <div class="row2">
          ${field("Corrección de meses pagados", numInput("offset", m?.offset || 0), "+1 si ya pagaste uno extra")}
          ${field("Abonos a capital", numInput("extraPaid", m?.extraPaid || 0), "Pagos anticipados")}
        </div>
      </details>`,
    extraButtons: m ? [{ label: "Eliminar", cls: "danger", onClick: () => { if (!confirm("¿Eliminar esta compra a MSI?")) return false; st.remove("msi", m.id); done("Eliminada"); } }] : [],
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      const total = parseAmount(fd.get("total"));
      if (!(total > 0)) return fieldError(form, "total", "Escribe el total");
      const accountId = fd.get("accountId");
      const acc = st.account(accountId);
      if (!acc) return toast("Elige la tarjeta"), false;
      const shares = readSplit(fd);
      if (shares === null) return toast("Elige la persona"), false;
      const date = fd.get("date") || today();
      st.upsert("msi", {
        ...(m || {}), id: m?.id || uid(), accountId, total, months: Number(fd.get("months")) || 12, date,
        firstDate: fd.get("firstDate") || nextDayOfMonth(Number(acc.cutoffDay), date) || addMonths(date, 1),
        concept: fd.get("concept").trim(), categoryId: fd.get("categoryId") || "",
        shares: shares.map((x) => ({ personId: x.personId, pct: x.pct })),
        offset: parseInt(fd.get("offset"), 10) || 0, extraPaid: parseAmount(fd.get("extraPaid") || 0) || 0,
        createdAt: m?.createdAt || Date.now(),
      });
      done("Compra a MSI guardada");
    },
  });
}

// ================= CUENTA =================
export function accountForm(a = null, preset = {}) {
  const v = a || { type: preset.type || "debit", initial: 0 };
  const nat = v.type === "credit" ? -(Number(v.initial) || 0) : Number(v.initial) || 0;
  const types = Object.entries(ACCOUNT_TYPES).map(([value, t]) => ({ value, label: t.label, icon: t.icon }));
  openSheet({
    title: a ? "Editar cuenta" : "Nueva cuenta",
    body: `
      ${field("Nombre", textInput("name", v.name, "BBVA, Amex, Efectivo…", a ? "" : "data-autofocus"))}
      <div class="field"><span class="lbl">Tipo</span>${segmented("type", types, v.type)}</div>
      <div data-show-if="type=credit">${field("Deuda inicial (incluye MSI vigentes)", numInput("initialDebt", nat || ""), "Lo que debes hoy. Después ajústalo con Cuadrar.")}</div>
      <div data-show-if="type=debit|cash|fund|savings">${field("Saldo inicial", numInput("initialBal", nat || ""), "Lo que tienes hoy.")}</div>
      <div data-show-if="type=credit">
        ${field("Límite de crédito", numInput("limit", v.limit || ""))}
        <div class="row2">
          ${field("Día de corte", numInput("cutoffDay", v.cutoffDay || "", "22"))}
          ${field("Día límite de pago", numInput("dueDay", v.dueDay || "", "8"))}
        </div>
      </div>
      ${a ? toggle("archived", "Archivar (ocultar)", !!a.archived) : ""}`,
    extraButtons: a ? [{ label: "Eliminar", cls: "danger", onClick: () => delAccount(a) }] : [],
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      const name = fd.get("name").trim();
      if (!name) return fieldError(form, "name", "Ponle nombre");
      const type = fd.get("type");
      const init = type === "credit" ? -(parseAmount(fd.get("initialDebt") || 0) || 0) : parseAmount(fd.get("initialBal") || 0) || 0;
      const acc = {
        ...(a || {}), id: a?.id || uid(), name, type, initial: round2(init),
        initialDate: a?.initialDate || today(),
        limit: type === "credit" ? parseAmount(fd.get("limit") || 0) || 0 : undefined,
        cutoffDay: type === "credit" ? parseInt(fd.get("cutoffDay"), 10) || null : undefined,
        dueDay: type === "credit" ? parseInt(fd.get("dueDay"), 10) || null : undefined,
        archived: !!fd.get("archived"),
      };
      st.upsert("accounts", acc);
      const s = S();
      if (type === "fund" && !s.settings.fund.accountId) { s.settings.fund.accountId = acc.id; st.save(); }
      done(a ? "Cuenta actualizada" : "Cuenta creada");
    },
  });
}
function delAccount(a) {
  const s = S();
  const n = s.tx.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length + s.msi.filter((m) => m.accountId === a.id).length;
  if (n) {
    if (!confirm(`${a.name} tiene ${n} movimientos. ¿Archivarla en lugar de borrarla?`)) return false;
    a.archived = true;
    st.upsert("accounts", a);
    return done("Cuenta archivada");
  }
  if (!confirm(`¿Eliminar ${a.name}?`)) return false;
  st.remove("accounts", a.id);
  if (s.settings.fund.accountId === a.id) { s.settings.fund.accountId = null; st.save(); }
  location.hash = "#/cuentas";
  done("Cuenta eliminada");
}

// ================= PERSONA =================
export function personForm(p = null) {
  const s = S();
  const v = p || { relation: "Familia", initial: 0 };
  const ini = Number(v.initial) || 0;
  const plan = v.plan || {};
  openSheet({
    title: p ? "Editar persona" : "Nueva persona",
    body: `
      ${field("Nombre", textInput("name", v.name, "Papá, Gabo, Liz…", p ? "" : "data-autofocus"))}
      <div class="field"><span class="lbl">Relación</span>${segmented("relation", ["Pareja", "Familia", "Amigo", "Otro"].map((x) => ({ value: x, label: x })), v.relation)}</div>
      ${toggle("isPartner", "Es mi pareja (cortes y gastos compartidos)", s.settings.partnerId ? s.settings.partnerId === v.id : v.relation === "Pareja")}
      <div class="field"><span class="lbl">Saldo pendiente de antes</span>${segmented("iniDir", [{ value: "owesMe", label: "Me debe" }, { value: "iOwe", label: "Le debo" }], ini < 0 ? "iOwe" : "owesMe")}</div>
      ${numInput("initial", Math.abs(ini) || "", "0.00")}
      ${toggle("hasPlan", "Tiene plan de pagos", !!v.plan, "Ej. $811 cada quincena")}
      <div data-show-if="hasPlan=on" class="plan-box">
        <div class="row2">
          ${field("Pago por periodo", numInput("planAmount", plan.amount || ""))}
          ${field("Cada", select("planFreq", [{ value: "semanal", label: "Semana" }, { value: "quincenal", label: "Quincena" }, { value: "mensual", label: "Mes" }], plan.freq || "quincenal"))}
        </div>
        <div class="row2">
          ${field("Primer pago", dateInput("planStart", plan.start || today()))}
          ${field("Total del plan", numInput("planTotal", plan.total || ""))}
        </div>
        ${field("Ya pagado antes de usar la app", numInput("planPaidBefore", plan.paidBefore || ""))}
      </div>
      ${p ? toggle("archived", "Archivar", !!p.archived) : ""}`,
    extraButtons: p ? [{ label: "Eliminar", cls: "danger", onClick: () => delPerson(p) }] : [],
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      const name = fd.get("name").trim();
      if (!name) return fieldError(form, "name", "Ponle nombre");
      const amt = parseAmount(fd.get("initial") || 0) || 0;
      const person = {
        ...(p || {}), id: p?.id || uid(), name, relation: fd.get("relation"),
        initial: round2(fd.get("iniDir") === "iOwe" ? -amt : amt), archived: !!fd.get("archived"),
        plan: fd.get("hasPlan") ? {
          amount: parseAmount(fd.get("planAmount")) || 0, freq: fd.get("planFreq"), start: fd.get("planStart") || today(),
          total: parseAmount(fd.get("planTotal") || 0) || 0, paidBefore: parseAmount(fd.get("planPaidBefore") || 0) || 0,
        } : null,
      };
      if (person.plan && !(person.plan.amount > 0)) return fieldError(form, "planAmount", "Pon el pago por periodo");
      st.upsert("people", person);
      if (fd.get("isPartner")) s.settings.partnerId = person.id;
      else if (s.settings.partnerId === person.id) s.settings.partnerId = null;
      st.save();
      done(p ? "Actualizado" : "Persona agregada");
    },
  });
}
function delPerson(p) {
  const s = S();
  const n = s.tx.filter((t) => t.personId === p.id || (t.shares || []).some((x) => x.personId === p.id)).length;
  if (n) {
    if (!confirm(`${p.name} tiene ${n} movimientos. ¿Archivar en lugar de borrar?`)) return false;
    p.archived = true;
    st.upsert("people", p);
    return done("Archivado");
  }
  if (!confirm(`¿Eliminar a ${p.name}?`)) return false;
  st.remove("people", p.id);
  if (s.settings.partnerId === p.id) { s.settings.partnerId = null; st.save(); }
  location.hash = "#/personas";
  done("Eliminado");
}

// ================= CERRAR CORTE =================
export function closeCorteForm(start, end) {
  const s = S();
  const p = st.partner();
  // cerrar antes de tiempo: el corte termina hoy y lo que venga entra al siguiente
  if (end > today()) end = today() >= start ? today() : start;
  const sum = corteSummary(s, start, end);
  const c = sum.closing;
  const owes = c > 0;
  const payDate = end;
  openSheet({
    title: "Cerrar corte",
    body: `
      <p class="muted">${fmtRange(start, end)}</p>
      <div class="corte-total ${owes ? "pos" : c < 0 ? "neg" : ""}">
        <small>${Math.abs(c) < 0.01 ? "Están a mano" : owes ? `${esc(p.name)} te debe` : `Le debes a ${esc(p.name)}`}</small>
        <b>${money(Math.abs(c))}</b>
      </div>
      ${Math.abs(c) >= 0.01 ? `
        ${toggle("pay", owes ? `Registrar que ${p.name} me pagó` : `Registrar que le pagué a ${p.name}`, true)}
        <div data-show-if="pay=on">
          ${field("Monto", amountInput("amount", c > 0 ? c : -c, { autofocus: false }), "Si es pago parcial, lo que falte pasa al siguiente corte.")}
          <div class="field"><span class="lbl">${owes ? "Entra a" : "Sale de"}</span>${chips("accountId", [{ value: "", label: "Sin cuenta" }, ...accountOptions((a) => a.type !== "credit")], defaultAccountId((a) => a.type !== "credit") || "", { cls: "scroll" })}</div>
        </div>` : ""}
      ${field("Nota", textInput("note", "", "Opcional"))}`,
    submitLabel: "Cerrar corte",
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      let txId = null, paid = 0;
      if (Math.abs(c) >= 0.01 && fd.get("pay")) {
        paid = parseAmount(fd.get("amount"));
        if (!(paid > 0)) return fieldError(form, "amount", "Escribe el monto");
        const tx = { id: uid(), type: owes ? "collect" : "repay", personId: p.id, amount: paid, accountId: fd.get("accountId") || "", concept: `Corte ${fmtRange(start, end)}`, date: payDate, shares: [], createdAt: Date.now() };
        st.upsert("tx", tx);
        txId = tx.id;
      }
      st.upsert("cortes", { id: uid(), start, end, opening: sum.opening, change: sum.change, closing: c, paid: owes ? paid : -paid, txId, note: fd.get("note").trim(), closedAt: Date.now() });
      done("Corte cerrado ✓");
    },
  });
}

// ================= METAS =================
export function goalForm(g = null) {
  const s = S();
  const v = g || { mode: "manual" };
  openSheet({
    title: g ? "Editar meta" : "Nueva meta de ahorro",
    body: `
      ${field("Nombre", textInput("name", v.name, "Vivir en otro lugar, boda, viaje…", g ? "" : "data-autofocus"))}
      <div class="row2">
        ${field("Ícono", textInput("icon", v.icon || "🌱", "🌱", 'maxlength="4"'), "", "small")}
        ${field("Meta ($)", numInput("target", v.target || ""))}
      </div>
      ${field("Fecha objetivo", dateInput("deadline", v.deadline || ""), "Opcional: calcula cuánto ahorrar por mes.")}
      <div class="field"><span class="lbl">¿Cómo se mide?</span>${segmented("mode", [{ value: "manual", label: "Aportaciones" }, { value: "account", label: "Saldo de cuenta" }, { value: "networth", label: "Patrimonio" }], v.mode)}</div>
      <div data-show-if="mode=account">${field("Cuenta", select("accountId", s.accounts.filter((a) => a.type !== "credit").map((a) => ({ value: a.id, label: a.name })), v.accountId))}</div>
      <p class="hint" data-show-if="mode=manual">Vas registrando lo que apartas para esta meta.</p>
      <p class="hint" data-show-if="mode=networth">Usa tu patrimonio neto (lo que tienes − deudas + lo que te deben).</p>`,
    extraButtons: g ? [{ label: "Eliminar", cls: "danger", onClick: () => { if (!confirm("¿Eliminar meta?")) return false; st.remove("goals", g.id); location.hash = "#/metas"; done("Meta eliminada"); } }] : [],
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      const name = fd.get("name").trim();
      if (!name) return fieldError(form, "name", "Ponle nombre");
      const target = parseAmount(fd.get("target"));
      if (!(target > 0)) return fieldError(form, "target", "Escribe la meta");
      st.upsert("goals", { ...(g || {}), id: g?.id || uid(), name, icon: fd.get("icon") || "🌱", target, deadline: fd.get("deadline") || "", mode: fd.get("mode"), accountId: fd.get("accountId") || "", contributions: g?.contributions || [] });
      done("Meta guardada");
    },
  });
}
export function contributionForm(g, c = null) {
  openSheet({
    title: c ? "Editar aportación" : `Aportar a ${g.name}`,
    body: `
      <div class="field"><span class="lbl">Tipo</span>${segmented("sign", [{ value: "in", label: "Aparto" }, { value: "out", label: "Retiro" }], c && c.amount < 0 ? "out" : "in")}</div>
      ${amountInput("amount", c ? Math.abs(c.amount) : "")}
      ${field("Fecha", dateInput("date", c?.date || today()))}
      ${field("Nota", textInput("note", c?.note, "Opcional"))}`,
    extraButtons: c ? [{ label: "Eliminar", cls: "danger", onClick: () => { g.contributions = g.contributions.filter((x) => x.id !== c.id); st.upsert("goals", g); done("Eliminada"); } }] : [],
    onSubmit: (form, fd) => {
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe un monto válido");
      const item = { id: c?.id || uid(), amount: fd.get("sign") === "out" ? -amount : amount, date: fd.get("date") || today(), note: fd.get("note").trim() };
      g.contributions = c ? g.contributions.map((x) => (x.id === c.id ? item : x)) : [...g.contributions, item];
      st.upsert("goals", g);
      done("Guardado");
    },
  });
}

// ================= PRESUPUESTO DEL FONDO =================
export function budgetForm() {
  const s = S();
  const f = s.settings.fund;
  const catOpts = [{ value: "", label: "Categoría…" }, ...categoryOptions("expense").map((c) => ({ value: c.value, label: `${c.icon} ${c.label}` }))];
  const row = (b = {}) => `<div class="brow">
      ${textInput("b_name", b.name || "", "Renta")}
      ${select("b_cat", catOpts, b.categoryId || "")}
      ${numInput("b_amount", b.amount || "", "0")}
      <button type="button" class="icon-btn" data-del-row>✕</button>
    </div>`;
  openSheet({
    title: "Presupuesto de la casa",
    wide: true,
    body: `
      <div class="row2">
        ${field("Mi parte (%)", numInput("myPct", f.myPct))}
        ${field(`Parte de ${partnerName()} (%)`, `<input disabled value="${100 - (Number(f.myPct) || 0)}"/>`)}
      </div>
      <div class="field"><span class="lbl">Gastos fijos mensuales</span><div id="bRows">${(f.budget.length ? f.budget : [{}]).map(row).join("")}</div></div>
      <button type="button" class="btn ghost full" id="bAdd">＋ Agregar gasto fijo</button>`,
    onMount: (form) => {
      const rows = form.querySelector("#bRows");
      form.querySelector("#bAdd").addEventListener("click", () => rows.insertAdjacentHTML("beforeend", row()));
      rows.addEventListener("click", (e) => e.target.closest("[data-del-row]")?.closest(".brow").remove());
      form.elements.myPct.addEventListener("input", () => (form.querySelector("input[disabled]").value = 100 - (parsePct(form.elements.myPct.value, 0) || 0)));
    },
    onSubmit: (form, fd) => {
      const names = fd.getAll("b_name"), cats = fd.getAll("b_cat"), amts = fd.getAll("b_amount");
      f.budget = names.map((n, i) => ({ id: uid(), name: n.trim() || st.category(cats[i])?.name || "Gasto", categoryId: cats[i], amount: parseAmount(amts[i] || 0) || 0 })).filter((b) => b.amount > 0);
      f.myPct = parsePct(fd.get("myPct"), 60);
      st.save();
      done("Presupuesto guardado");
    },
  });
}

// ================= CATEGORÍA =================
export function categoryForm(c = null, kind = "expense") {
  const v = c || { kind, icon: "📦" };
  openSheet({
    title: c ? "Editar categoría" : "Nueva categoría",
    body: `
      <div class="row2">
        ${field("Ícono", textInput("icon", v.icon, "📦", 'maxlength="4"'), "", "small")}
        ${field("Nombre", textInput("name", v.name, "Mascotas", c ? "" : "data-autofocus"))}
      </div>
      <div class="field"><span class="lbl">Tipo</span>${segmented("kind", [{ value: "expense", label: "Gasto" }, { value: "income", label: "Ingreso" }], v.kind)}</div>
      <div data-show-if="kind=income">${toggle("real", "Cuenta como ingreso real", v.real !== false, "Apágalo para reembolsos o aportaciones")}</div>`,
    extraButtons: c ? [{ label: "Eliminar", cls: "danger", onClick: () => {
      const s = S();
      const used = s.tx.some((t) => t.categoryId === c.id) || s.msi.some((m) => m.categoryId === c.id);
      if (used) { toast("Está en uso; no se puede eliminar"); return false; }
      if (!confirm("¿Eliminar categoría?")) return false;
      st.remove("categories", c.id); done("Eliminada");
    } }] : [],
    onMount: wireConditional,
    onSubmit: (form, fd) => {
      const name = fd.get("name").trim();
      if (!name) return fieldError(form, "name", "Ponle nombre");
      const k = fd.get("kind");
      st.upsert("categories", { ...(c || {}), id: c?.id || uid(), name, icon: fd.get("icon") || "📦", kind: k, real: k === "income" ? !!fd.get("real") : undefined });
      done("Guardada");
    },
  });
}

// ================= MENÚ ＋ =================
export function addMenu() {
  const p = st.partner();
  const items = [
    ["expense", "receipt", "Gasto"],
    ["income", "arrow-down-left", "Ingreso"],
    ...(p ? [["house", "house", "Gasto de casa"]] : []),
    ["payment", "credit-card", "Pago a tarjeta"],
    ["transfer", "arrow-left-right", "Transferir"],
    ["person", "handshake", "Préstamo / deuda"],
    ...(p ? [["partnerPaid", "users", `${p.name} pagó`]] : []),
    ["msi", "calendar", "Compra a MSI"],
    ["bonus", "star", "Bono"],
    ["fundIn", "house-plus", "Aportar al fondo"],
    ["adjust", "scale", "Ajuste"],
  ];
  openSheet({
    title: "¿Qué registras?",
    body: `<div class="add-grid">${items.map(([k, i, l]) => `<button type="button" class="add-item" data-add="${k}"><span class="tile accent">${icon(i)}</span><span>${esc(l)}</span></button>`).join("")}</div>`,
    onMount: (form) => form.addEventListener("click", (e) => {
      const b = e.target.closest("[data-add]");
      if (!b) return;
      closeSheet(true);
      openAdd(b.dataset.add);
    }),
  });
}
/** Abre el formulario completo (desde "Más opciones" del registro rápido). */
export function openFull(mode, preset = {}) {
  const s = S();
  if (mode === "menu") return addMenu();
  if (mode === "income") return incomeForm(null, preset);
  if (mode === "house") {
    if (preset.payer === "partner") return partnerPaidForm(null, { ...preset, house: true });
    if (preset.payer === "fund") return expenseForm(null, { ...preset, accountId: s.settings.fund.accountId, split: "none", house: true });
    return expenseForm(null, { ...preset, house: true });
  }
  return expenseForm(null, preset);
}
export function openAdd(kind, preset = {}) {
  const s = S();
  const fundId = s.settings.fund.accountId;
  switch (kind) {
    case "expense": return quickAdd("expense", preset);
    case "house": return quickAdd("house", preset);
    case "income": return quickAdd("income", preset);
    case "expenseFull": return expenseForm(null, preset);
    case "incomeFull": return incomeForm(null, preset);
    case "payment": return transferForm(null, { payment: true, ...preset });
    case "transfer": return transferForm(null, preset);
    case "person": return personTxForm(null, preset);
    case "partnerPaid": return partnerPaidForm(null, preset);
    case "msi": return msiForm(null, preset);
    case "bonus": return incomeForm(null, { categoryId: "i_bono", title: "Bono / bonificación", accountId: s.accounts.find((a) => a.type === "credit" && !a.archived)?.id, ...preset });
    case "adjust": return adjustForm(null, preset);
    case "fundIn":
      if (!fundId) { toast("Configura tu fondo común primero"); location.hash = "#/fondo"; return; }
      return transferForm(null, { toAccountId: fundId, title: "Aportar al fondo", ...preset });
    case "fundPartner":
      return incomeForm(null, { accountId: fundId, categoryId: "i_aporte", personId: s.settings.partnerId || "", title: `Aportación de ${partnerName()}` });
    case "fundExpense":
      return quickAdd("house", { payer: "fund", ...preset });
  }
}

// ================= Abrir / eliminar movimiento =================
export function openTx(t) {
  if (!t) return;
  if (t.type === "expense") return expenseForm(t);
  if (t.type === "income") return incomeForm(t);
  if (t.type === "transfer") return transferForm(t);
  if (t.type === "adjust") return adjustForm(t);
  if (t.type === "debt" && t.total != null) return partnerPaidForm(t);
  return personTxForm(t);
}
function delTx(t) {
  if (!confirm("¿Eliminar este movimiento?")) return false;
  st.remove("tx", t.id);
  // si era el pago de un corte, desvincúlalo
  const s = S();
  s.cortes.forEach((c) => { if (c.txId === t.id) c.txId = null; });
  st.save();
  done("Eliminado");
}

export { EVENT_LABEL, planInfo, kv };

// ================= SUSCRIPCIÓN =================
export function subForm(x = null) {
  const s = S();
  const v = x || { freq: "mensual", active: true, categoryId: "c_subs" };
  openSheet({
    title: x ? "Suscripción" : "Nueva suscripción",
    body: `
      ${field("Nombre", textInput("name", v.name, "Netflix, iCloud, Spotify…", x ? "" : "data-autofocus"))}
      <div class="row2">
        ${field("Monto", numInput("amount", v.amount ?? ""))}
        ${field("Cada", select("freq", [{ value: "mensual", label: "Mes" }, { value: "anual", label: "Año" }], v.freq))}
      </div>
      <div class="field"><span class="lbl">Tarjeta donde se cobra</span>${chips("accountId", [{ value: "", label: "Sin asignar" }, ...accountOptions()], v.accountId || "", { cls: "scroll" })}</div>
      <div class="row2">
        ${field("Día de cobro", numInput("day", v.day || "", "15"))}
        ${field("Categoría", select("categoryId", S().categories.filter((c) => c.kind === "expense").map((c) => ({ value: c.id, label: c.name })), v.categoryId))}
      </div>
      ${field("Buscar cobros que digan", textInput("match", v.match || "", "Opcional, ej. “open ai”"), "Para validar contra tus movimientos si el nombre del cargo es distinto.")}
      ${field("Nota", textInput("note", v.note || "", "Plan familiar, compartida con Liz…"))}
      ${toggle("active", "Activa", v.active !== false)}`,
    extraButtons: [
      ...(x ? [{ label: "Eliminar", cls: "danger", onClick: () => { if (!confirm("¿Eliminar suscripción?")) return false; st.remove("subs", x.id); done("Eliminada"); } }] : []),
      ...(x && x.active ? [{ label: "Registrar cobro", onClick: () => { closeSheet(true); quickAdd("expense", { amount: x.amount, concept: x.name, accountId: x.accountId || undefined, categoryId: x.categoryId }); return false; } }] : []),
    ],
    onSubmit: (form, fd) => {
      const name = fd.get("name").trim();
      if (!name) return fieldError(form, "name", "Ponle nombre");
      const amount = parseAmount(fd.get("amount"));
      if (!(amount > 0)) return fieldError(form, "amount", "Escribe el monto");
      st.upsert("subs", { ...(x || {}), id: x?.id || uid(), name, amount, freq: fd.get("freq"), accountId: fd.get("accountId") || "", day: parseInt(fd.get("day"), 10) || null,
        categoryId: fd.get("categoryId"), match: fd.get("match").trim(), note: fd.get("note").trim(), active: !!fd.get("active") });
      done("Suscripción guardada");
    },
  });
}
