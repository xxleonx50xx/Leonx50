// ================= UI: hoja inferior, avisos y piezas de formulario =================
import { esc, money, today } from "./format.js";

const $ = (s, el = document) => el.querySelector(s);

// ---------- Aviso breve ----------
let toastT = null;
export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- Hoja inferior (modal) ----------
let current = null;
export function openSheet({ title, body, submitLabel = "Guardar", onSubmit, onMount, extraButtons = [], wide = false }) {
  closeSheet(true);
  const root = $("#sheetRoot");
  root.innerHTML = `
    <div class="sheet-backdrop" data-sheet-close></div>
    <form class="sheet ${wide ? "wide" : ""}" novalidate autocomplete="off">
      <div class="sheet-grab"></div>
      <header class="sheet-head">
        <h3>${esc(title)}</h3>
        <button type="button" class="icon-btn" data-sheet-close aria-label="Cerrar">✕</button>
      </header>
      <div class="sheet-body">${body}</div>
      ${onSubmit || extraButtons.length ? `<footer class="sheet-foot">
        ${extraButtons.map((b, i) => `<button type="button" class="btn ${b.cls || "ghost"}" data-sheet-extra="${i}">${esc(b.label)}</button>`).join("")}
        ${onSubmit ? `<button type="submit" class="btn primary">${esc(submitLabel)}</button>` : ""}
      </footer>` : ""}
    </form>`;
  root.classList.add("open");
  document.body.classList.add("sheet-open");
  const form = $("form", root);
  current = { form };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const res = onSubmit(form, new FormData(form));
    if (res !== false) closeSheet();
  });
  root.querySelectorAll("[data-sheet-close]").forEach((b) => b.addEventListener("click", () => closeSheet()));
  root.querySelectorAll("[data-sheet-extra]").forEach((b) =>
    b.addEventListener("click", () => {
      const r = extraButtons[Number(b.dataset.sheetExtra)].onClick(form);
      if (r !== false) closeSheet();
    })
  );
  onMount?.(form);
  // enfoca el monto si existe (abre el teclado numérico)
  const first = form.querySelector("[data-autofocus]");
  if (first) setTimeout(() => first.focus(), 260);
  return form;
}
export function closeSheet(immediate) {
  const root = $("#sheetRoot");
  if (!root.classList.contains("open")) return;
  document.body.classList.remove("sheet-open");
  if (immediate) { root.classList.remove("open"); root.innerHTML = ""; current = null; return; }
  root.classList.add("closing");
  setTimeout(() => { root.classList.remove("open", "closing"); root.innerHTML = ""; current = null; }, 200);
}
export const sheetOpen = () => !!current;

/** Marca un campo con error y muestra mensaje. */
export function fieldError(form, name, msg) {
  const el = form.querySelector(`[name="${name}"]`);
  const wrap = el?.closest(".field") || el;
  wrap?.classList.add("err");
  toast(msg);
  el?.focus?.();
  setTimeout(() => wrap?.classList.remove("err"), 2500);
  return false;
}

// ---------- Piezas de formulario ----------
export const field = (label, inner, hint = "", cls = "") =>
  `<label class="field ${cls}"><span class="lbl">${esc(label)}</span>${inner}${hint ? `<small class="hint">${hint}</small>` : ""}</label>`;

export const amountInput = (name = "amount", value = "", { autofocus = true, placeholder = "0.00" } = {}) =>
  `<div class="amount-wrap"><span class="cur">$</span><input class="amount" name="${name}" inputmode="decimal" placeholder="${placeholder}" value="${value === "" || value == null ? "" : esc(value)}" ${autofocus ? "data-autofocus" : ""}/></div>`;

export const textInput = (name, value = "", placeholder = "", attrs = "") =>
  `<input type="text" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}/>`;

export const numInput = (name, value = "", placeholder = "", attrs = "") =>
  `<input type="text" inputmode="decimal" name="${name}" value="${value === "" || value == null ? "" : esc(value)}" placeholder="${esc(placeholder)}" ${attrs}/>`;

export const dateInput = (name, value = today(), attrs = "") => `<input type="date" name="${name}" value="${esc(value || "")}" ${attrs}/>`;

export function select(name, options, selected, attrs = "") {
  return `<select name="${name}" ${attrs}>${options
    .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(selected ?? "") ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("")}</select>`;
}

/** Grupo de "chips" tipo radio/checkbox. options: {value,label,icon,sub,attrs} */
export function chips(name, options, selected, { multi = false, cls = "" } = {}) {
  const sel = multi ? new Set(selected || []) : null;
  return `<div class="chips ${cls}">${options
    .map((o) => {
      const on = multi ? sel.has(o.value) : String(o.value) === String(selected ?? "");
      return `<label class="chip"><input type="${multi ? "checkbox" : "radio"}" name="${name}" value="${esc(o.value)}" ${on ? "checked" : ""} ${o.attrs || ""}/><span>${o.icon ? `<i>${o.icon}</i>` : ""}${esc(o.label)}${o.sub ? `<em>${esc(o.sub)}</em>` : ""}</span></label>`;
    })
    .join("")}</div>`;
}

export const segmented = (name, options, selected) => chips(name, options, selected, { cls: "seg" });

export const toggle = (name, label, checked, sub = "") =>
  `<label class="toggle"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}/><span class="sw"></span><span class="tl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</span></label>`;

export const moneyCls = (n) => (n > 0.004 ? "pos" : n < -0.004 ? "neg" : "zero");
export const bar = (pct, cls = "") => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div>`;
export const kv = (k, v, cls = "") => `<div class="kv ${cls}"><span>${esc(k)}</span><b>${v}</b></div>`;
export const moneyHtml = (n, cls) => `<span class="money ${cls ?? ""}">${money(n)}</span>`;
