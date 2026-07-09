// ================= FASTEST · controlador principal =================
import { loadState, saveState, resetState } from "./storage.js";
import { Tracker } from "./tracker.js";
import { analyzeDrive } from "./analysis.js";
import * as MapView from "./map.js";
import * as R from "./rewards.js";

const $ = (s) => document.querySelector(s);
const state = loadState();
let tracker = null;
let liveCombo = { value: 1, secAbove: 0, max: 1, lastT: 0 };
let modalQueue = [];

// ---------- arranque ----------
boot();

function boot() {
  applyTheme(state.equippedTheme);
  ensureDailyChallenge();
  MapView.initMap();
  renderHudPlayer();
  wireNav();
  wireDrive();
  wireGarage();
  wireWheel();

  // ubicación inicial para centrar el mapa
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (p) => MapView.centerOn(p.coords.latitude, p.coords.longitude, 16),
      () => {}, { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  if (!state.onboarded) {
    $("#onboarding").classList.remove("hidden");
    $("#onbAccept").onclick = () => {
      state.onboarded = true; saveState(state);
      $("#onboarding").classList.add("hidden");
    };
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

// ---------- navegación entre pantallas ----------
function show(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $("#screen-" + screen).classList.add("active");
  if (screen === "drive") setTimeout(() => MapView.initMap() && window.dispatchEvent(new Event("resize")), 50);
}
function wireNav() {
  document.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => show(b.dataset.nav));
  $("#btnGarage").onclick = () => { renderGarage("perfil"); show("garage"); };
}

// ================= HUD en vivo =================
function renderHudPlayer() {
  $("#hudRank").textContent = R.rankFor(state.level);
  $("#hudLevel").textContent = "Nv " + state.level;
  $("#hudFp").textContent = fmt(state.fp) + " FP";
  const need = R.xpForLevel(state.level);
  $("#hudXp").style.width = Math.min(100, (state.xp / need) * 100) + "%";
}

function setSpeedo(kmh) {
  $("#speedValue").textContent = Math.round(kmh);
  // arco: 0..200 km/h mapea a 0..443 (longitud visible del trazo)
  const frac = Math.min(1, kmh / 200);
  $("#speedoArc").style.strokeDashoffset = 443 - 443 * frac;
  const col = kmh < 45 ? "var(--accent)" : kmh < 80 ? "#c6ff33" : kmh < 110 ? "var(--gold)" : "var(--danger)";
  $("#speedoArc").style.stroke = col;
}

function wireDrive() {
  tracker = new Tracker({
    onUpdate: onTrackUpdate,
    onAutoStart: () => { setRecordingUI(true); toast("🏁", "¡Arrancaste! Registrando…"); },
  });

  $("#btnDrive").onclick = () => {
    if (!tracker.recording && !tracker.armed) {
      // modo escucha: espera a que superes 10 km/h (o graba de una)
      try {
        MapView.resetLive();
        tracker.arm(false);
        setArmedUI(true);
        toast("📡", "Buscando señal… ponte en marcha");
      } catch (e) { toast("⚠️", e.message); }
    } else {
      finishDrive();
    }
  };
}

function setArmedUI(on) {
  $("#statusPill").textContent = on ? "Esperando movimiento (>10 km/h)…" : "Toca ▶ y ponte en marcha";
  $("#btnDrive").textContent = on ? "■" : "▶";
  $("#btnDrive").classList.toggle("recording", on);
}
function setRecordingUI(on) {
  $("#statusPill").textContent = on ? "● Registrando manejo" : "Toca ▶ y ponte en marcha";
  $("#btnDrive").textContent = on ? "■" : "▶";
  $("#btnDrive").classList.toggle("recording", on);
}

function onTrackUpdate(u) {
  if (u.error) { toast("⚠️", "GPS: " + u.error); return; }
  setSpeedo(u.speed);
  MapView.updateMe(u.lat, u.lng, true);

  if (u.recording) {
    MapView.extendLive([u.lat, u.lng]);
    $("#statDist").textContent = u.distanceKm.toFixed(1);
    $("#statAvg").textContent = Math.round(u.avgSpeed);
    $("#statMax").textContent = Math.round(u.maxSpeed);
    $("#statTime").textContent = fmtTime(u.elapsed);
    updateCombo(u.speed, u.elapsed);
  }
}

function updateCombo(kmh, elapsed) {
  const badge = $("#comboBadge");
  const dt = elapsed - liveCombo.lastT;
  liveCombo.lastT = elapsed;
  if (kmh >= 60) {
    liveCombo.secAbove += dt;
    const lvl = Math.min(5, 1 + Math.floor(liveCombo.secAbove / 6));
    if (lvl !== liveCombo.value) { liveCombo.value = lvl; badge.classList.remove("hidden"); badge.style.animation = "none"; void badge.offsetWidth; badge.style.animation = "pop .3s ease"; }
    liveCombo.max = Math.max(liveCombo.max, lvl);
    badge.textContent = "COMBO x" + lvl;
    badge.classList.toggle("hidden", lvl < 2);
  } else if (kmh < 15) {
    liveCombo.secAbove = 0; liveCombo.value = 1; badge.classList.add("hidden");
  }
}

// ================= fin del manejo -> análisis + recompensas =================
function finishDrive() {
  const raw = tracker.stop();
  setArmedUI(false); setRecordingUI(false);
  $("#comboBadge").classList.add("hidden");
  const maxCombo = liveCombo.max;
  liveCombo = { value: 1, secAbove: 0, max: 1, lastT: 0 };

  if (!raw || raw.distanceKm < 0.05 || raw.points.length < 4) {
    toast("🤏", "Manejo muy corto, no se guardó.");
    return;
  }

  const { segments, newRecords } = analyzeDrive(raw, state.zonas);
  const drive = {
    ...raw, segments, newRecords, maxCombo,
    id: raw.startedAt, date: raw.startedAt,
  };
  const rewards = R.computeDriveRewards(drive);
  drive.fp = rewards.fp; drive.xp = rewards.xp; drive.stars = rewards.stars;

  applyDriveToState(drive);
  MapView.drawSegments(segments);
  renderSummary(drive);
  show("summary");
  flushModals();
}

function applyDriveToState(drive) {
  // totales
  state.fp += drive.fp;
  state.xp += drive.xp;
  state.totalDistance += drive.distanceKm;
  state.totalDrives += 1;
  state.totalStars += drive.stars;
  state.bestTopSpeed = Math.max(state.bestTopSpeed, drive.maxSpeed);

  // récords en zonas guardadas
  drive.segments.forEach(seg => {
    if (!seg.zonaId) return;
    const z = state.zonas.find(z => z.id === seg.zonaId);
    if (!z) return;
    z.passes = (z.passes || 0) + 1;
    if (seg.stars > (z.bestStars || 0)) z.bestStars = seg.stars;
    if (seg.avgSpeed > (z.bestAvg || 0)) z.bestAvg = seg.avgSpeed;
  });

  // niveles
  let leveled = false;
  while (state.xp >= R.xpForLevel(state.level)) {
    state.xp -= R.xpForLevel(state.level);
    state.level += 1; leveled = true;
  }
  if (leveled) queueModal("⚡", "¡NIVEL " + state.level + "!", "Nuevo rango: " + R.rankFor(state.level));

  // desbloqueos
  R.THEMES.forEach(t => {
    if (!state.unlocked.includes(t.id) && R.meetsRequirement(t, state, state.totalStars)) {
      state.unlocked.push(t.id);
      queueModal(t.emoji, "¡DESBLOQUEADO!", "Tema " + t.name + " · pruébalo en el Garage");
    }
  });

  // racha diaria
  const today = dayKey();
  if (state.lastDriveDay !== today) {
    const yest = dayKey(Date.now() - 864e5);
    state.streak = state.lastDriveDay === yest ? state.streak + 1 : 1;
    state.lastDriveDay = today;
  }

  // desafío diario
  updateChallenge(drive);

  // ruleta cada 10 manejos
  state.drivesSinceSpin += 1;
  if (state.drivesSinceSpin >= 10) {
    state.drivesSinceSpin = 0;
    state.spinsAvailable += 1;
    queueModal("🎡", "¡GIRO DISPONIBLE!", "Ganaste un giro en La Ruleta. Ábrela desde el Garage › Premios.");
  }

  // historial (guardamos ligero: sin todos los puntos)
  const light = { ...drive, points: undefined, segments: drive.segments.map(s => ({ ...s, coords: undefined })) };
  state.drives.unshift(light);
  state.drives = state.drives.slice(0, 30);

  saveState(state);
  renderHudPlayer();
}

function ensureDailyChallenge() {
  const today = dayKey();
  if (!state.dailyChallenge || state.dailyChallenge.day !== today) {
    state.dailyChallenge = R.rollDailyChallenge(today);
    saveState(state);
  }
}
function updateChallenge(drive) {
  const c = state.dailyChallenge;
  if (!c || c.done) return;
  const add = {
    dist: drive.distanceKm, stars: drive.stars, top: drive.maxSpeed,
    segs: drive.segments.length, combo: drive.maxCombo,
  }[c.metric] || 0;
  if (c.metric === "top" || c.metric === "combo") c.progress = Math.max(c.progress, add);
  else c.progress += add;
  if (c.progress >= c.target) {
    c.done = true; state.fp += c.fp;
    queueModal(c.emoji, "¡DESAFÍO COMPLETO!", c.text + " · +" + c.fp + " FP");
  }
}

// ================= modales de recompensa (cola) =================
function queueModal(emoji, title, desc) { modalQueue.push({ emoji, title, desc }); }
function flushModals() {
  if (!modalQueue.length) return;
  const m = modalQueue.shift();
  $("#rewardEmoji").textContent = m.emoji;
  $("#rewardTitle").textContent = m.title;
  $("#rewardDesc").textContent = m.desc;
  const modal = $("#rewardModal");
  modal.classList.remove("hidden");
  $("#rewardClose").onclick = () => { modal.classList.add("hidden"); flushModals(); };
}

// ================= Resumen del manejo =================
function renderSummary(drive) {
  const starsHtml = (n) => Array.from({ length: 3 }, (_, i) =>
    `<span class="star ${i < n ? "on" : ""}" style="animation-delay:${i * .08}s">★</span>`).join("");

  const segs = drive.segments.map((s, i) => `
    <div class="seg-row">
      <div class="seg-ico">${s.type === "recta" ? "🛣️" : "↩️"}</div>
      <div class="seg-info">
        <div class="seg-name">${s.name}${s.isRecord ? '<span class="badge-new">RÉCORD</span>' : ""}</div>
        <div class="seg-meta">${Math.round(s.distanceM)} m · ${s.avgSpeed} km/h prom · obj ${s.target}</div>
      </div>
      <div style="text-align:right">
        <div class="stars">${starsHtml(s.stars)}</div>
        ${s.zonaId ? "" : `<button class="mini-save" data-seg="${i}">＋ Zona</button>`}
      </div>
    </div>`).join("");

  $("#summaryBody").innerHTML = `
    <div class="fp-earned">+${fmt(drive.fp)}<small> FP</small></div>
    <div class="big-metrics">
      <div class="metric"><div class="metric-num">${drive.distanceKm.toFixed(1)}<small> km</small></div><div class="metric-lbl">distancia</div></div>
      <div class="metric"><div class="metric-num">${drive.maxSpeed}</div><div class="metric-lbl">máx km/h</div></div>
      <div class="metric"><div class="metric-num">${drive.stars} ⭐</div><div class="metric-lbl">estrellas</div></div>
    </div>
    <div class="card">
      <div class="card-title">Tramos (${drive.segments.length})</div>
      ${segs || '<div class="empty" style="padding:16px">Sin tramos claros. Maneja un poco más para dividir la ruta.</div>'}
    </div>
    <div class="card">
      <div class="card-title">Detalle</div>
      <div class="seg-meta">Velocidad promedio: <b style="color:var(--ink)">${drive.avgSpeed} km/h</b></div>
      <div class="seg-meta">Duración: <b style="color:var(--ink)">${fmtTime(drive.durationSec)}</b> · Combo máx: <b style="color:var(--ink)">x${drive.maxCombo}</b></div>
      <div class="seg-meta">XP ganada: <b style="color:var(--ink)">${drive.xp}</b>${drive.newRecords ? ` · <b style="color:var(--gold)">${drive.newRecords} récord(s)</b>` : ""}</div>
    </div>
    <button class="btn-primary" data-nav="drive">Continuar</button>`;

  $("#summaryBody").querySelector("[data-nav]").onclick = () => show("drive");
  $("#summaryBody").querySelectorAll(".mini-save").forEach(btn => {
    btn.onclick = () => saveZonaFromSegment(drive.segments[+btn.dataset.seg], btn);
  });
}

function saveZonaFromSegment(seg, btn) {
  const name = prompt("Nombre de la zona (ej. Curva del malecón):", seg.name);
  if (!name) return;
  const def = seg.type === "recta" ? Math.max(seg.avgSpeed, 60) : Math.max(seg.avgSpeed, 40);
  const tRaw = prompt("Velocidad objetivo para 3★ (km/h):", def);
  const target = Math.max(10, parseInt(tRaw, 10) || def);
  state.zonas.push({
    id: "z" + Date.now(), name, type: seg.type,
    startPoint: seg.startPoint, endPoint: seg.endPoint, bearing: seg.bearing,
    target, bestStars: seg.stars, bestAvg: seg.avgSpeed, passes: 1,
  });
  saveState(state);
  btn.outerHTML = '<span class="badge-new">GUARDADA</span>';
  toast("📍", "Zona «" + name + "» guardada");
}

// ================= Garage =================
function wireGarage() {
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    renderGarage(t.dataset.tab);
  });
}
function renderGarage(tab) {
  const body = $("#garageBody");
  if (tab === "perfil") body.innerHTML = tplPerfil();
  else if (tab === "zonas") body.innerHTML = tplZonas();
  else if (tab === "premios") { body.innerHTML = tplPremios(); wirePremios(); }
  else if (tab === "historial") body.innerHTML = tplHistorial();
}

function tplPerfil() {
  const need = R.xpForLevel(state.level);
  return `
    <div class="card" style="text-align:center">
      <div class="rank-badge" style="font-size:15px;padding:8px 16px">${R.rankFor(state.level)}</div>
      <div style="font-family:Orbitron;font-weight:900;font-size:40px;margin:10px 0 2px">Nv ${state.level}</div>
      <div class="xp-bar" style="height:10px"><div class="xp-fill" style="width:${Math.min(100,state.xp/need*100)}%"></div></div>
      <div class="seg-meta" style="margin-top:6px">${fmt(state.xp)} / ${fmt(need)} XP</div>
    </div>
    <div class="big-metrics">
      <div class="metric"><div class="metric-num">${fmt(state.fp)}</div><div class="metric-lbl">FP totales</div></div>
      <div class="metric"><div class="metric-num">${state.totalDrives}</div><div class="metric-lbl">manejos</div></div>
      <div class="metric"><div class="metric-num">${state.totalStars} ⭐</div><div class="metric-lbl">estrellas</div></div>
    </div>
    <div class="big-metrics">
      <div class="metric"><div class="metric-num">${state.totalDistance.toFixed(0)}<small> km</small></div><div class="metric-lbl">recorridos</div></div>
      <div class="metric"><div class="metric-num">${state.bestTopSpeed}</div><div class="metric-lbl">récord km/h</div></div>
      <div class="metric"><div class="metric-num">${state.streak}🔥</div><div class="metric-lbl">racha días</div></div>
    </div>
    <button class="btn-ghost" id="btnReset">Reiniciar progreso</button>`;
}

function tplZonas() {
  if (!state.zonas.length) return `<div class="empty"><span class="em">📍</span>Aún no guardas zonas.<br>Al terminar un manejo, toca «＋ Zona» en una recta o curva.</div>`;
  return state.zonas.map(z => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="seg-name">${z.type === "recta" ? "🛣️" : "↩️"} ${z.name}</div>
          <div class="seg-meta">objetivo ${z.target} km/h · ${z.passes || 0} pasadas · mejor ${z.bestAvg || 0} km/h</div>
        </div>
        <div class="stars">${Array.from({length:3},(_,i)=>`<span class="star ${i<(z.bestStars||0)?"on":""}">★</span>`).join("")}</div>
      </div>
    </div>`).join("");
}

function tplPremios() {
  const totalStars = state.totalStars;
  const themes = R.THEMES.map(t => {
    const unlocked = state.unlocked.includes(t.id);
    const equipped = state.equippedTheme === t.id;
    return `<div class="unlock ${unlocked ? "" : "locked"} ${equipped ? "equipped" : ""}" data-theme="${t.id}" data-unlocked="${unlocked}">
      ${equipped ? '<span class="unlock-tag eq">EN USO</span>' : (!unlocked ? '<span class="unlock-tag lk">🔒</span>' : "")}
      <div class="unlock-emoji">${t.emoji}</div>
      <div class="unlock-name">${t.name}</div>
      <div class="unlock-req">${unlocked ? "Toca para equipar" : t.reqText}</div>
    </div>`;
  }).join("");

  const c = state.dailyChallenge;
  const chPct = c ? Math.min(100, c.progress / c.target * 100) : 0;
  const challenge = c ? `
    <div class="card">
      <div class="card-title">Desafío diario</div>
      <div class="challenge">
        <div class="seg-ico">${c.emoji}</div>
        <div class="prog">
          <div class="seg-name" style="font-size:15px">${c.text} ${c.done ? "✅" : ""}</div>
          <div class="bar"><div style="width:${chPct}%"></div></div>
          <div class="seg-meta">${c.metric==="dist"?c.progress.toFixed(1):Math.round(c.progress)} / ${c.target} · +${c.fp} FP</div>
        </div>
      </div>
    </div>` : "";

  const spin = `
    <div class="card" style="text-align:center">
      <div class="card-title">La Ruleta</div>
      <div style="font-size:38px">🎡</div>
      <div class="seg-meta" style="margin:6px 0 12px">Giros disponibles: <b style="color:var(--gold);font-size:18px">${state.spinsAvailable}</b> · faltan <b style="color:var(--ink)">${10 - state.drivesSinceSpin}</b> manejos para el próximo</div>
      <button class="btn-primary" id="btnGoWheel" ${state.spinsAvailable ? "" : "disabled"}>${state.spinsAvailable ? "GIRAR AHORA" : "Sin giros"}</button>
    </div>`;

  return challenge + spin + `<div class="card-title" style="padding-left:4px">Temas (${state.unlocked.length}/${R.THEMES.length})</div><div class="unlock-grid">${themes}</div>`;
}

function wirePremios() {
  document.querySelectorAll("[data-theme]").forEach(el => el.onclick = () => {
    if (el.dataset.unlocked !== "true") { toast("🔒", "Aún bloqueado"); return; }
    state.equippedTheme = el.dataset.theme; saveState(state);
    applyTheme(el.dataset.theme); MapView.refreshLiveColor();
    renderGarage("premios"); renderHudPlayer();
  });
  const go = $("#btnGoWheel");
  if (go) go.onclick = () => { if (state.spinsAvailable > 0) { openWheel(); } };
  const reset = $("#btnReset");
  if (reset) reset.onclick = () => {
    if (confirm("¿Borrar todo tu progreso? Esto no se puede deshacer.")) {
      Object.assign(state, resetState()); applyTheme(state.equippedTheme);
      ensureDailyChallenge(); renderHudPlayer(); renderGarage("perfil");
    }
  };
}

function tplHistorial() {
  if (!state.drives.length) return `<div class="empty"><span class="em">🏁</span>Sin manejos todavía.<br>¡Sal a la calle y arranca!</div>`;
  return state.drives.map(d => `
    <div class="card">
      <div style="display:flex;justify-content:space-between">
        <div class="seg-name">${new Date(d.date).toLocaleDateString("es-MX",{day:"numeric",month:"short"})} · ${new Date(d.date).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</div>
        <div style="color:var(--gold);font-weight:700">+${fmt(d.fp)} FP</div>
      </div>
      <div class="seg-meta">${d.distanceKm.toFixed(1)} km · ${d.maxSpeed} km/h máx · ${d.stars} ⭐ · ${d.segments.length} tramos</div>
    </div>`).join("");
}

// ================= La Ruleta (canvas) =================
let wheelRotation = 0;
let spinning = false;

function wireWheel() {
  drawWheel();
  $("#btnSpin").onclick = doSpin;
}
function openWheel() {
  drawWheel();
  $("#wheelSub").textContent = "Giros disponibles: " + state.spinsAvailable;
  $("#wheelResult").textContent = "";
  $("#btnSpin").disabled = state.spinsAvailable <= 0;
  $("#btnSpin").textContent = "GIRAR";
  show("wheel");
}
function drawWheel() {
  const cv = $("#wheelCanvas"); if (!cv) return;
  const ctx = cv.getContext("2d");
  const n = R.WHEEL_PRIZES.length, cx = cv.width / 2, cy = cv.height / 2, rad = cx - 6;
  const slice = (Math.PI * 2) / n;
  ctx.clearRect(0, 0, cv.width, cv.height);
  R.WHEEL_PRIZES.forEach((p, i) => {
    const start = -Math.PI / 2 + i * slice;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, start, start + slice);
    ctx.closePath(); ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 2; ctx.stroke();
    // texto
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(start + slice / 2);
    ctx.textAlign = "right"; ctx.fillStyle = "#04121a";
    ctx.font = "700 13px Rajdhani, sans-serif";
    ctx.fillText(p.label, rad - 12, 5);
    ctx.restore();
  });
  // centro
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#05060f"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3; ctx.stroke();
}
function doSpin() {
  if (spinning || state.spinsAvailable <= 0) return;
  spinning = true;
  state.spinsAvailable -= 1; saveState(state);
  $("#btnSpin").disabled = true;

  const n = R.WHEEL_PRIZES.length, sliceDeg = 360 / n;
  const idx = R.pickWheelIndex();
  const jitter = (Math.random() - 0.5) * sliceDeg * 0.6;
  const target = 360 * 6 - (idx * sliceDeg + sliceDeg / 2) + jitter;
  wheelRotation += target;
  $("#wheelCanvas").style.transform = `rotate(${wheelRotation}deg)`;

  setTimeout(() => {
    const prize = R.WHEEL_PRIZES[idx];
    applyWheelPrize(prize);
    const cls = "r-" + prize.rarity;
    $("#wheelResult").innerHTML = `<span class="${cls}">${prize.rarity.toUpperCase()}</span> · ${prize.label}!`;
    spinning = false;
    $("#btnSpin").disabled = state.spinsAvailable <= 0;
    $("#wheelSub").textContent = "Giros disponibles: " + state.spinsAvailable;
    renderHudPlayer();
  }, 4700);
}
function applyWheelPrize(p) {
  if (p.fp) state.fp += p.fp;
  if (p.extraSpin) state.spinsAvailable += 1;
  // xpBoost queda registrado para el próximo manejo (simplificado: bono FP inmediato)
  if (p.xpBoost) state.fp += 200;
  saveState(state);
}

// ================= Tema (colores neón) =================
function applyTheme(id) {
  const t = R.themeById(id);
  const root = document.documentElement.style;
  root.setProperty("--accent", t.accent);
  root.setProperty("--accent-2", t.accent2);
  root.setProperty("--accent-glow", hexA(t.accent, .55));
  document.querySelector('meta[name="theme-color"]').setAttribute("content", "#05060f");
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ================= util =================
function toast(em, msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="em">${em}</span>${msg}`;
  $("#toastStack").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; setTimeout(() => el.remove(), 400); }, 2600);
}
function fmt(n) { return Math.round(n).toLocaleString("es-MX"); }
function fmtTime(sec) {
  sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}
function dayKey(ts) { const d = new Date(ts || Date.now()); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
