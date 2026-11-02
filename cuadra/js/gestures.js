// ================= Gestos tipo app nativa de iPhone =================
// - Deslizar desde el borde izquierdo: regresar
// - Deslizar un movimiento a la izquierda: Duplicar / Eliminar
// - Arrastrar hacia abajo la hoja inferior: cerrarla
import { closeSheet } from "./ui.js";

export function initGestures({ onDelete, onDuplicate }) {
  // ---------- deslizar desde el borde para regresar ----------
  let edge = null;
  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (t.clientX > 24 || document.body.classList.contains("sheet-open")) return;
    if (document.getElementById("back")?.classList.contains("hidden")) return;
    edge = { x: t.clientX, y: t.clientY, dx: 0, view: document.querySelector("#main .view") };
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!edge) return;
    const t = e.touches[0];
    edge.dx = Math.max(0, t.clientX - edge.x);
    if (Math.abs(t.clientY - edge.y) > 40 && edge.dx < 30) { reset(); return; }
    if (edge.view) { edge.view.style.transition = "none"; edge.view.style.transform = `translateX(${edge.dx}px)`; edge.view.style.opacity = String(1 - edge.dx / 600); }
  }, { passive: true });
  const reset = () => {
    if (edge?.view) { edge.view.style.transition = "transform .2s, opacity .2s"; edge.view.style.transform = ""; edge.view.style.opacity = ""; }
    edge = null;
  };
  document.addEventListener("touchend", () => {
    if (!edge) return;
    if (edge.dx > 90) { const v = edge.view; if (v) { v.style.transition = "transform .18s"; v.style.transform = "translateX(100%)"; } edge = null; setTimeout(() => history.back(), 120); }
    else reset();
  });

  // ---------- deslizar filas de movimientos ----------
  let sw = null;
  const closeOpen = (except) => document.querySelectorAll(".swipe.open").forEach((x) => { if (x !== except) { x.classList.remove("open"); x.querySelector(".row").style.transform = ""; } });
  document.addEventListener("touchstart", (e) => {
    const wrap = e.target.closest(".swipe");
    if (!wrap || e.target.closest(".sw-acts")) { if (!e.target.closest(".swipe")) closeOpen(); return; }
    const t = e.touches[0];
    sw = { wrap, row: wrap.querySelector(".row"), x: t.clientX, y: t.clientY, dx: 0, base: wrap.classList.contains("open") ? -150 : 0, dir: null };
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!sw) return;
    const t = e.touches[0];
    const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (!sw.dir) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; sw.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v"; if (sw.dir === "h") closeOpen(sw.wrap); }
    if (sw.dir !== "h") return;
    sw.dx = Math.min(0, Math.max(-190, sw.base + dx));
    sw.row.style.transition = "none";
    sw.row.style.transform = `translateX(${sw.dx}px)`;
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (!sw) return;
    const { wrap, row, dir } = sw;
    row.style.transition = "transform .22s cubic-bezier(.2,.9,.3,1)";
    if (dir === "h") {
      const open = sw.dx < -60;
      wrap.classList.toggle("open", open);
      row.style.transform = open ? "translateX(-150px)" : "";
      if (open) wrap.dataset.justSwiped = "1", setTimeout(() => delete wrap.dataset.justSwiped, 350);
    }
    sw = null;
  });
  // evita que el "tap" al terminar de deslizar abra el movimiento
  document.addEventListener("click", (e) => {
    const wrap = e.target.closest(".swipe");
    if (wrap?.dataset.justSwiped && !e.target.closest(".sw-acts")) { e.stopPropagation(); e.preventDefault(); return; }
    if (wrap?.classList.contains("open") && !e.target.closest(".sw-acts")) { e.stopPropagation(); e.preventDefault(); closeOpen(); return; }
    const act = e.target.closest(".sw-acts [data-sw]");
    if (act) {
      e.stopPropagation(); e.preventDefault();
      const id = act.closest(".swipe").dataset.id;
      if (act.dataset.sw === "del") onDelete(id); else onDuplicate(id);
    }
  }, true);

  // ---------- arrastrar la hoja hacia abajo para cerrarla ----------
  let sh = null;
  document.addEventListener("touchstart", (e) => {
    const sheet = e.target.closest(".sheet");
    if (!sheet) return;
    const body = sheet.querySelector(".sheet-body");
    const onHandle = e.target.closest(".sheet-grab, .sheet-head");
    if (!onHandle && body && body.scrollTop > 0) return;
    if (!onHandle && !e.target.closest(".sheet-body")) return;
    const t = e.touches[0];
    sh = { sheet, y: t.clientY, x: t.clientX, dy: 0, handle: !!onHandle, dir: null };
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!sh) return;
    const t = e.touches[0];
    const dy = t.clientY - sh.y, dx = t.clientX - sh.x;
    if (!sh.dir) { if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return; sh.dir = dy > 0 && Math.abs(dy) > Math.abs(dx) ? "down" : "no"; }
    if (sh.dir !== "down" || (!sh.handle && sh.sheet.querySelector(".sheet-body").scrollTop > 0)) return;
    sh.dy = Math.max(0, dy);
    sh.sheet.style.transition = "none";
    sh.sheet.style.transform = `translateY(${sh.dy}px)`;
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (!sh) return;
    const s = sh.sheet;
    if (sh.dy > 120) { s.style.transition = "transform .18s"; s.style.transform = "translateY(100%)"; setTimeout(() => closeSheet(true), 170); }
    else { s.style.transition = "transform .2s"; s.style.transform = ""; }
    sh = null;
  });
}
