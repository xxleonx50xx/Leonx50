// ================= FASTEST · controlador principal (v2) =================
import { loadState, saveState, resetState } from "./storage.js";
import { Tracker } from "./tracker.js";
import { analyzeDrive } from "./analysis.js";
import * as MapView from "./map.js";
import * as R from "./rewards.js";
import * as Fog from "./fog.js";
import { runTutorial } from "./tutorial.js";
import { getCity, nearbySpot } from "./spots.js";
import { buildBoard, CATEGORIES } from "./leaderboard.js";
import { MEDALS, checkMedals } from "./achievements.js";
import { sfx, unlock as sfxUnlock, setEnabled as sfxSetEnabled } from "./sfx.js";
import * as Circ from "./circuits.js";
import { ic } from "./icons.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const state = loadState();
const city = getCity("culiacan");
let tracker = null;
let modalQueue = [];
let liveCombo = { value: 1, secAbove: 0, max: 1, lastT: 0 };
let exploredSet = new Set(state.explored);
let currentRank = "top";
let pendingSpotInput = null;

boot();

function boot() {
  sfxSetEnabled(state.sfxOn !== false);
  applyTheme(state.equippedTheme);
  ensureDailyChallenge();
  MapView.initMap();
  MapView.initFog(state.explored);
  addSpotMarkers();
  renderHudPlayer();
  updateExploreChip();
  wireGlobal();
  wireDrive();
  wireGarage();
  wireRank();
  wireWheel();
  wireProfileEditor();
  wireCircuits();
  wireSignin();
  initIcons();
  importChallengeFromUrl();

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (p) => MapView.centerOn(p.coords.latitude, p.coords.longitude, 16),
      () => {}, { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  if (!state.signedIn) $("#signin").classList.remove("hidden");
  else afterSignin();

  registerSW();
}

// registra el SW y recarga automáticamente cuando hay versión nueva
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  // Solo recargamos si la página YA estaba controlada por un SW previo
  // (así una actualización se aplica sola; en la primera visita no recarga).
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return; reloaded = true; location.reload();
    });
  }
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) nw.postMessage("skipWaiting");
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60000);
  }).catch(() => {});
}

// ---- acceso ----
function wireSignin() {
  $("#appleBtn").innerHTML = ic("apple", 20) + " Continuar con Apple";
  $("#appleBtn").onclick = () => signIn("apple");
  $("#guestBtn").onclick = () => signIn("guest");
}
function signIn(method) {
  sfx.coin();
  // Nota: Sign in with Apple real requiere backend + Apple Developer. Por ahora
  // creamos una cuenta local; el nombre alimenta el perfil y el ranking.
  let name = state.profile.driver;
  if (!name) { name = (prompt(method === "apple" ? "¿Cómo te llamas, piloto? (Apple ID se conectará con el servidor)" : "Elige tu nombre de piloto:", "") || "").trim(); }
  state.account = { method, name: name || "Piloto" };
  if (name && !state.profile.driver) state.profile.driver = name;
  state.signedIn = true; saveState(state);
  $("#signin").classList.add("hidden");
  afterSignin();
}
function afterSignin() {
  if (!state.onboarded) {
    renderOnboardingList();
    $("#onboarding").classList.remove("hidden");
    $("#onbAccept").onclick = () => {
      state.onboarded = true; saveState(state);
      $("#onboarding").classList.add("hidden"); sfx.click();
      if (!state.tutorialDone) startTutorial();
    };
  } else if (!state.tutorialDone) {
    startTutorial();
  }
}
function renderOnboardingList() {
  const items = [
    [ic("map", 22), "Desbloquea el mapa", "conforme recorres tu ciudad."],
    [ic("gauge", 22), "Mide tu velocidad", "en cada recta y curva."],
    [ic("trophy", 22), "Sube de rango", "y compite en el Ranking."],
  ];
  $("#onbList").innerHTML = items.map(([i, t, d]) => `<li><span class="onb-ic">${i}</span><span><b>${t}</b> ${d}</span></li>`).join("");
}

// ---- inyección de iconos en la interfaz estática ----
function initIcons() {
  $("#btnDrive").innerHTML = `<span>${ic("play", 26)}</span>`;
  $("#exploreChip").innerHTML = `${ic("map", 15)}<b id="exploreP">0%</b>`;
  $("#btnInvite").innerHTML = `${ic("plus", 15)} Invitar`;
  $("#btnNewCircuit").innerHTML = `${ic("plus", 15)} Crear`;
  $("#btnEditProfile").innerHTML = ic("edit", 18);
  $$("[data-close]").forEach(b => b.innerHTML = ic("close", 18));
  $("#cbCancel").innerHTML = ic("close", 16);
}

// desbloquea audio al primer toque (requisito iOS)
function wireGlobal() {
  const unlockOnce = () => { sfxUnlock(); document.removeEventListener("pointerdown", unlockOnce); };
  document.addEventListener("pointerdown", unlockOnce);

  $$("#tabbar .tabbtn").forEach(b => b.onclick = () => { sfx.click(); goTab(b.dataset.go); });
  $$("[data-close]").forEach(b => b.onclick = () => { sfx.click(); closeOverlay(b.dataset.close); });
}

function goTab(tab) {
  $$(".tabview").forEach(s => s.classList.remove("active"));
  $("#tab-" + tab).classList.add("active");
  $$("#tabbar .tabbtn").forEach(b => b.classList.toggle("active", b.dataset.go === tab));
  if (tab === "drive") setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
  if (tab === "rank") renderRank(currentRank);
  if (tab === "garage") renderGarage(activeGarageTab());
  if (tab === "circuits") renderCircuits();
}
function openOverlay(id) { $("#ov-" + id).classList.remove("hidden"); }
function closeOverlay(id) { $("#ov-" + id).classList.add("hidden"); }

// ================= HUD =================
function renderHudPlayer() {
  $("#hudRank").textContent = R.rankFor(state.level);
  $("#hudLevel").textContent = "Nv " + state.level;
  $("#hudFp").textContent = fmt(state.fp) + " FP";
  const need = R.xpForLevel(state.level);
  $("#hudXp").style.width = Math.min(100, (state.xp / need) * 100) + "%";
}
function updateExploreChip() { $("#exploreP").textContent = Fog.explorePct(exploredSet.size) + "%"; }

function setSpeedo(kmh) {
  $("#speedValue").textContent = Math.round(kmh);
  const frac = Math.min(1, kmh / 200);
  $("#speedoArc").style.strokeDashoffset = 443 - 443 * frac;
  const col = kmh < 45 ? "var(--accent)" : kmh < 80 ? "#f5c542" : kmh < 110 ? "#ff7a3d" : "var(--accent)";
  $("#speedoArc").style.stroke = col;
}

// ================= exploración / spots en el mapa =================
function addSpotMarkers() {
  const map = MapView.getMap(); if (!map) return;
  city.spots.forEach(s => {
    const visited = state.spotsVisited.includes(s.id);
    const icon = L.divIcon({
      className: "spot-marker",
      html: `<div class="spot-pin ${visited ? "on" : ""}"><span>${ic("camera", 15)}</span></div>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
    L.marker([s.lat, s.lng], { icon }).addTo(map).on("click", () => { goTab("garage"); switchGarage("spots"); });
  });
}

function revealAt(lat, lng) {
  const radar = R.perkLevel(state, "radar");
  const keys = [Fog.cellKey(lat, lng)];
  if (radar > 0) { // revela celdas vecinas
    for (let dx = -radar; dx <= radar; dx++) for (let dy = -radar; dy <= radar; dy++)
      keys.push(Fog.cellKey(lat + dy * Fog.CELL, lng + dx * Fog.CELL));
  }
  const fresh = keys.filter(k => !exploredSet.has(k));
  if (!fresh.length) { MapView.fogLive(lat, lng); return; }
  fresh.forEach(k => exploredSet.add(k));
  MapView.revealCellKeys(fresh);
  MapView.fogLive(lat, lng);
  updateExploreChip();
}

// ================= DRIVE =================
function wireDrive() {
  tracker = new Tracker({
    onUpdate: onTrackUpdate,
    onAutoStart: () => { setRecUI(true); sfx.checkpoint(); toast("🏁", "¡Arrancaste! Registrando…"); },
  });
  $("#btnDrive").onclick = () => {
    sfx.click();
    if (!tracker.recording && !tracker.armed) {
      try { MapView.resetLive(); tracker.arm(false); setArmUI(true); toast("📡", "Buscando señal… ponte en marcha"); }
      catch (e) { toast("⚠️", e.message); }
    } else finishDrive();
  };
}
function setArmUI(on) {
  $("#statusPill").textContent = on ? "Esperando movimiento (>10 km/h)…" : "Toca para arrancar";
  $("#btnDrive").querySelector("span").innerHTML = ic(on ? "stop" : "play", 26);
  $("#btnDrive").classList.toggle("rec", on);
}
function setRecUI(on) {
  $("#statusPill").textContent = on ? "Registrando manejo" : "Toca para arrancar";
  $("#btnDrive").querySelector("span").innerHTML = ic(on ? "stop" : "play", 26);
  $("#btnDrive").classList.toggle("rec", on);
}

let lastGpsErr = 0;
function onTrackUpdate(u) {
  if (u.error) {
    if (u.code !== 3 && Date.now() - lastGpsErr > 8000) { lastGpsErr = Date.now(); toast("⚠️", "Señal GPS débil…"); }
    return;
  }
  setSpeedo(u.speed);
  MapView.setCar(u.lat, u.lng, u.heading != null ? u.heading : 90, true);
  revealAt(u.lat, u.lng);
  checkSpotProximity(u.lat, u.lng);
  handleCircuitRun(u.lat, u.lng);
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
  const dt = elapsed - liveCombo.lastT; liveCombo.lastT = elapsed;
  const fast = 1 + R.perkLevel(state, "combo_fast");
  if (kmh >= 60) {
    liveCombo.secAbove += dt * fast;
    const lvl = Math.min(5, 1 + Math.floor(liveCombo.secAbove / 6));
    if (lvl !== liveCombo.value && lvl >= 2) { sfx.coin(); }
    liveCombo.value = lvl; liveCombo.max = Math.max(liveCombo.max, lvl);
    badge.textContent = "COMBO x" + lvl; badge.classList.toggle("hidden", lvl < 2);
  } else if (kmh < 15) { liveCombo.secAbove = 0; liveCombo.value = 1; badge.classList.add("hidden"); }
}

let spotCooldown = {};
function checkSpotProximity(lat, lng) {
  const s = nearbySpot(lat, lng, city, 160);
  if (!s) return;
  if (state.spotsVisited.includes(s.id)) return;
  if (spotCooldown[s.id] && Date.now() - spotCooldown[s.id] < 20000) return;
  spotCooldown[s.id] = Date.now();
  toast(s.emoji, `¡Estás en ${s.name}! Ve a Garage › Spots para tu foto (+${s.fp} FP)`);
  sfx.checkpoint();
}

function finishDrive() {
  const raw = tracker.stop();
  setArmUI(false); setRecUI(false);
  $("#comboBadge").classList.add("hidden");
  const maxCombo = liveCombo.max;
  liveCombo = { value: 1, secAbove: 0, max: 1, lastT: 0 };
  MapView.fogLive(null);

  if (!raw || raw.distanceKm < 0.05 || raw.points.length < 4) { toast("🤏", "Manejo muy corto, no se guardó."); return; }
  const { segments, newRecords } = analyzeDrive(raw, state.zonas);
  const drive = { ...raw, segments, newRecords, maxCombo, id: raw.startedAt, date: raw.startedAt };
  const rw = R.computeDriveRewards(drive, state);
  drive.fp = rw.fp; drive.xp = rw.xp; drive.stars = rw.stars;
  applyDriveToState(drive);
  MapView.drawSegments(segments);
  renderSummary(drive);
  openOverlay("summary");
  flushModals();
}

function applyDriveToState(drive) {
  state.fp += drive.fp; state.xp += drive.xp;
  state.totalDistance += drive.distanceKm; state.totalDrives += 1;
  state.totalTimeSec += Math.round(drive.durationSec);
  state.totalStars += drive.stars;
  state.bestTopSpeed = Math.max(state.bestTopSpeed, drive.maxSpeed);
  state.bestAvgSpeed = Math.max(state.bestAvgSpeed, drive.avgSpeed);

  drive.segments.forEach(seg => {
    if (!seg.zonaId) return;
    const z = state.zonas.find(z => z.id === seg.zonaId); if (!z) return;
    z.passes = (z.passes || 0) + 1;
    if (seg.stars > (z.bestStars || 0)) z.bestStars = seg.stars;
    if (seg.avgSpeed > (z.bestAvg || 0)) z.bestAvg = seg.avgSpeed;
  });

  let leveled = false;
  while (state.xp >= R.xpForLevel(state.level)) { state.xp -= R.xpForLevel(state.level); state.level += 1; leveled = true; }
  if (leveled) { sfx.levelUp(); queueModal("⚡", "¡NIVEL " + state.level + "!", "Nuevo rango: " + R.rankFor(state.level)); }

  R.THEMES.forEach(t => {
    if (!state.unlocked.includes(t.id) && R.meetsRequirement(t, state, state.totalStars)) {
      state.unlocked.push(t.id);
      queueModal(t.emoji, "¡TEMA DESBLOQUEADO!", t.name + " · pruébalo en Garage › Premios");
    }
  });

  const today = dayKey();
  if (state.lastDriveDay !== today) {
    const yest = dayKey(Date.now() - 864e5);
    state.streak = state.lastDriveDay === yest ? state.streak + 1 : 1;
    state.lastDriveDay = today;
  }

  state.explored = Array.from(exploredSet);
  updateChallenge(drive);

  state.drivesSinceSpin += 1;
  if (state.drivesSinceSpin >= 10) { state.drivesSinceSpin = 0; state.spinsAvailable += 1; queueModal("🎡", "¡GIRO DISPONIBLE!", "Ganaste un giro en La Ruleta (Garage › Premios)."); }

  awardMedals();

  const light = { ...drive, points: undefined, segments: drive.segments.map(s => ({ ...s, coords: undefined })) };
  state.drives.unshift(light); state.drives = state.drives.slice(0, 30);
  saveState(state); renderHudPlayer();
}

function awardMedals() {
  state._spotTotal = city.spots.length;
  const earned = checkMedals(state);
  earned.forEach(m => { sfx.medal(); queueModal(m.emoji, "MEDALLA: " + m.name, m.desc + " · +" + m.fp + " FP"); state.fp += m.fp; });
}

// ================= modales (cola) =================
function queueModal(emoji, title, desc) { modalQueue.push({ emoji, title, desc }); }
function flushModals() {
  if (!modalQueue.length) return;
  const m = modalQueue.shift();
  $("#rewardEmoji").textContent = m.emoji; $("#rewardTitle").textContent = m.title; $("#rewardDesc").textContent = m.desc;
  $("#rewardModal").classList.remove("hidden");
  $("#rewardClose").onclick = () => { sfx.click(); $("#rewardModal").classList.add("hidden"); flushModals(); };
}

// ================= RESUMEN =================
function renderSummary(drive) {
  const starsHtml = (n) => Array.from({ length: 3 }, (_, i) => `<span class="star ${i < n ? "on" : ""}" style="animation-delay:${i * .08}s">★</span>`).join("");
  const segs = drive.segments.map((s, i) => `
    <div class="seg-row">
      <div class="seg-ico">${ic(s.type === "recta" ? "straight" : "curve", 20)}</div>
      <div class="seg-info">
        <div class="seg-name">${s.name}${s.isRecord ? '<span class="badge-new">RÉCORD</span>' : ""}</div>
        <div class="seg-meta">${Math.round(s.distanceM)} m · ${s.avgSpeed} km/h · obj ${s.target}</div>
      </div>
      <div style="text-align:right">
        <div class="stars">${starsHtml(s.stars)}</div>
        ${s.zonaId ? "" : `<button class="mini-save" data-seg="${i}">＋ Zona</button>`}
      </div>
    </div>`).join("");
  $("#summaryBody").innerHTML = `
    <div class="fp-earned">+${fmt(drive.fp)}<small> FP</small></div>
    <div class="big3">
      <div class="m"><b>${drive.distanceKm.toFixed(1)}<small> km</small></b><span>distancia</span></div>
      <div class="m"><b>${drive.maxSpeed}</b><span>máx km/h</span></div>
      <div class="m"><b>${drive.stars} ⭐</b><span>estrellas</span></div>
    </div>
    <div class="card"><div class="card-title">Tramos (${drive.segments.length})</div>
      ${segs || '<div class="empty" style="padding:16px">Sin tramos claros. Maneja un poco más.</div>'}</div>
    <div class="card"><div class="card-title">Detalle</div>
      <div class="seg-meta">Prom: <b style="color:var(--ink)">${drive.avgSpeed} km/h</b> · Duración: <b style="color:var(--ink)">${fmtTime(drive.durationSec)}</b> · Combo máx: <b style="color:var(--ink)">x${drive.maxCombo}</b></div>
      <div class="seg-meta">XP: <b style="color:var(--ink)">${drive.xp}</b>${drive.newRecords ? ` · <b style="color:var(--gold)">${drive.newRecords} récord(s)</b>` : ""}</div></div>
    <button class="btn-primary" id="sumCont">Continuar</button>`;
  $("#sumCont").onclick = () => { sfx.click(); closeOverlay("summary"); };
  $$("#summaryBody .mini-save").forEach(btn => btn.onclick = () => saveZonaFromSegment(drive.segments[+btn.dataset.seg], btn));
}

function saveZonaFromSegment(seg, btn) {
  const name = prompt("Nombre de la zona:", seg.name); if (!name) return;
  const def = seg.type === "recta" ? Math.max(seg.avgSpeed, 60) : Math.max(seg.avgSpeed, 40);
  const target = Math.max(10, parseInt(prompt("Velocidad objetivo para 3★ (km/h):", def), 10) || def);
  state.zonas.push({ id: "z" + Date.now(), name, type: seg.type, startPoint: seg.startPoint, endPoint: seg.endPoint, bearing: seg.bearing, target, bestStars: seg.stars, bestAvg: seg.avgSpeed, passes: 1 });
  saveState(state); btn.outerHTML = '<span class="badge-new">GUARDADA</span>'; sfx.coin(); toast("📍", "Zona «" + name + "» guardada");
}

// ================= TUTORIAL =================
function startTutorial() {
  $("#ov-tutorial").classList.remove("hidden");
  MapView.centerOn(24.833, -107.418, 14);
  const ctrl = runTutorial({
    onStart: () => {},
    onStep: (p) => {
      setSpeedo(p.speed);
      MapView.setCar(p.lat, p.lng, p.heading, true);
      revealAt(p.lat, p.lng);
      $("#statMax").textContent = Math.max(+$("#statMax").textContent, Math.round(p.speed));
    },
    onCaption: (html) => { $("#tutCaption").innerHTML = html; sfx.checkpoint(); },
    onDone: () => finishTutorial(),
  });
  $("#tutSkip").onclick = () => { sfx.click(); ctrl.skip(); };
}
function finishTutorial() {
  $("#ov-tutorial").classList.add("hidden");
  MapView.fogLive(null);
  state.tutorialDone = true; state.explored = Array.from(exploredSet); saveState(state);
  updateExploreChip();
  queueModal("🏁", "¡Listo!", "Ese fue un recorrido de práctica. Ahora sal a la calle, toca ▶ y empieza a desbloquear tu ciudad.");
  flushModals();
}

// ================= RANKING =================
function wireRank() {
  $("#rankTabs").innerHTML = CATEGORIES.map(c => `<button class="seg ${c.id === currentRank ? "active" : ""}" data-cat="${c.id}">${c.label}</button>`).join("");
  $$("#rankTabs .seg").forEach(b => b.onclick = () => { sfx.click(); currentRank = b.dataset.cat; $$("#rankTabs .seg").forEach(x => x.classList.toggle("active", x === b)); renderRank(currentRank); });
  $("#btnInvite").onclick = inviteFriends;
}
function renderRank(catId) {
  const { cat, rows } = buildBoard(catId, state);
  $("#rankBody").innerHTML = `<div class="card">${rows.map((r, i) => `
    <div class="lb-row ${r.isPlayer ? "me" : ""}">
      <div class="lb-pos ${i < 3 ? "top" : ""}">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</div>
      <div class="lb-av">${r.photo ? `<img src="${r.photo}">` : (r.isPlayer ? ic("user", 18) : (r.emoji || ic("user", 18)))}</div>
      <div class="lb-info"><div class="lb-name">${escapeHtml(r.name)}</div><div class="lb-car">${escapeHtml(r.car)}</div></div>
      <div class="lb-val">${cat.fmt(r.value)}<small> ${cat.unit}</small></div>
    </div>`).join("")}</div>
    <div class="empty" style="padding:16px 8px"><small>El ranking online entre amigos llega pronto. Por ahora compites contra pilotos locales; invita amigos para reservar tu lugar.</small></div>`;
}
async function inviteFriends() {
  sfx.click();
  const url = location.href.split("#")[0];
  const text = `🏁 Te reto en Fastest — mide tu velocidad y desbloquea tu ciudad. Únete: ${url}`;
  try { if (navigator.share) { await navigator.share({ title: "Fastest", text, url }); return; } } catch (e) {}
  try { await navigator.clipboard.writeText(text); toast("🔗", "Invitación copiada al portapapeles"); }
  catch (e) { prompt("Comparte este link:", url); }
}

// ================= GARAGE =================
function activeGarageTab() { const a = $("#garageTabs .seg.active"); return a ? a.dataset.tab : "perfil"; }
function switchGarage(tab) { $$("#garageTabs .seg").forEach(x => x.classList.toggle("active", x.dataset.tab === tab)); goTab("garage"); renderGarage(tab); }
function wireGarage() {
  $$("#garageTabs .seg").forEach(t => t.onclick = () => { sfx.click(); $$("#garageTabs .seg").forEach(x => x.classList.remove("active")); t.classList.add("active"); renderGarage(t.dataset.tab); });
  $("#btnEditProfile").onclick = () => { sfx.click(); openProfileEditor(); };
}
function renderGarage(tab) {
  const b = $("#garageBody");
  if (tab === "perfil") { b.innerHTML = tplPerfil(); wirePerfil(); }
  else if (tab === "medallas") b.innerHTML = tplMedallas();
  else if (tab === "spots") { b.innerHTML = tplSpots(); wireSpots(); }
  else if (tab === "premios") { b.innerHTML = tplPremios(); wirePremios(); }
  else if (tab === "zonas") b.innerHTML = tplZonas();
  else if (tab === "historial") b.innerHTML = tplHistorial();
}

function tplPerfil() {
  const p = state.profile, need = R.xpForLevel(state.level);
  const carLine = [p.brand, p.model].filter(Boolean).join(" ") || p.carName || "Registra tu carro →";
  const chestReady = state.lastRewardDay !== dayKey();
  const perkIc = { fp_boost: "magnet", xp_boost: "bolt", combo_fast: "route", radar: "radar" };
  const skills = R.PERKS.map(perk => {
    const lvl = R.perkLevel(state, perk.id), max = lvl >= perk.max, cost = R.perkCost(perk, lvl);
    return `<div class="seg-row">
      <div class="seg-ico">${ic(perkIc[perk.id] || "spark", 20)}</div>
      <div class="seg-info"><div class="seg-name">${perk.name} <span style="color:var(--muted);font-weight:600">Nv ${lvl}/${perk.max}</span></div><div class="seg-meta">${perk.desc}</div></div>
      <button class="mini-save" data-perk="${perk.id}" ${max ? "disabled style=opacity:.4" : ""}>${max ? "MÁX" : fmt(cost) + " FP"}</button>
    </div>`;
  }).join("");
  return `
    <div class="profile-hero">
      <div class="ph-photo" style="background-image:url('${p.photo || ""}')"></div>
      <div class="ph-grad"></div>
      <div class="ph-rank">${R.rankFor(state.level)}</div>
      <div class="ph-body">
        <div class="ph-driver">${escapeHtml(p.driver || "Piloto")}</div>
        <div class="ph-car">${escapeHtml(carLine)}${p.plate ? ` <span class="tag">${escapeHtml(p.plate)}</span>` : ""}</div>
      </div>
    </div>
    <div class="card"><div class="chip-line" style="font-size:13px;margin-bottom:6px"><span>Nivel ${state.level} · ${R.rankFor(state.level)}</span><span>${fmt(state.xp)}/${fmt(need)} XP</span></div>
      <div class="xpbar" style="height:9px"><i style="width:${Math.min(100, state.xp / need * 100)}%"></i></div></div>
    <div class="big3">
      <div class="m"><b>${fmt(state.fp)}</b><span>FP</span></div>
      <div class="m"><b>${state.totalDrives}</b><span>manejos</span></div>
      <div class="m"><b>${state.medals.length}</b><span>medallas</span></div>
    </div>
    <div class="big3">
      <div class="m"><b>${state.totalDistance.toFixed(0)}<small> km</small></b><span>recorridos</span></div>
      <div class="m"><b>${state.bestTopSpeed}</b><span>récord km/h</span></div>
      <div class="m"><b>${state.streak}</b><span>${ic("flame", 12)} racha</span></div>
    </div>
    <div class="card"><div class="card-title">${ic("gift", 16)} Cofre diario</div>
      <div class="challenge"><div class="seg-ico">${ic("gift", 20)}</div>
        <div class="prog"><div class="seg-name">${chestReady ? "Tienes un cofre listo" : "Vuelve mañana por más"}</div>
          <div class="seg-meta">${chestReady ? "Recompensa sorpresa de FP" : "Ya reclamaste el de hoy"}</div></div>
        <button class="btn-save" id="claimChest" ${chestReady ? "" : "disabled style=opacity:.4"}>${chestReady ? "Abrir" : ic("check", 16)}</button></div></div>
    <div class="card"><div class="card-title">${ic("spark", 16)} Skills</div>${skills}</div>
    <button class="btn-ghost" id="btnSfx">${state.sfxOn !== false ? ic("sound", 17) + " Sonidos activados" : ic("mute", 17) + " Sonidos apagados"}</button>
    <div style="height:10px"></div>
    <button class="btn-ghost" id="btnReset">Reiniciar progreso</button>`;
}
function wirePerfil() {
  const chest = $("#claimChest"); if (chest) chest.onclick = claimChest;
  $$("[data-perk]").forEach(btn => btn.onclick = () => buyPerk(btn.dataset.perk));
  $("#btnSfx").onclick = () => { state.sfxOn = !(state.sfxOn !== false); sfxSetEnabled(state.sfxOn); saveState(state); sfx.click(); renderGarage("perfil"); };
  $("#btnReset").onclick = () => { if (confirm("¿Borrar todo tu progreso?")) { Object.assign(state, resetState()); exploredSet = new Set(); MapView.initFog([]); applyTheme(state.equippedTheme); ensureDailyChallenge(); renderHudPlayer(); updateExploreChip(); renderGarage("perfil"); } };
}
function claimChest() {
  if (state.lastRewardDay === dayKey()) return;
  const r = R.dailyReward(dayKey());
  state.fp += r.fp; if (r.spin) state.spinsAvailable += 1;
  state.lastRewardDay = dayKey(); saveState(state); sfx.jackpot();
  queueModal("🎁", "COFRE DIARIO", "+" + r.fp + " FP" + (r.spin ? " y ¡1 giro de ruleta!" : "")); flushModals();
  renderHudPlayer(); renderGarage("perfil");
}
function buyPerk(id) {
  const perk = R.PERKS.find(p => p.id === id); const lvl = R.perkLevel(state, id);
  if (lvl >= perk.max) return;
  const cost = R.perkCost(perk, lvl);
  if (state.fp < cost) { toast("💸", "Te faltan " + fmt(cost - state.fp) + " FP"); return; }
  state.fp -= cost; state.perks[id] = lvl + 1; saveState(state); sfx.coin();
  toast(perk.emoji, perk.name + " mejorado a Nv " + (lvl + 1)); renderHudPlayer(); renderGarage("perfil");
}

function tplMedallas() {
  const got = state.medals.length;
  return `<div class="card"><div class="card-title">${ic("medal", 16)} Medallas ${got}/${MEDALS.length}</div>
    ${MEDALS.map(m => { const on = state.medals.includes(m.id);
      return `<div class="seg-row" style="${on ? "" : "opacity:.45"}">
        <div class="seg-ico ${on ? "earned" : ""}">${on ? ic("medal", 22) : ic("lock", 18)}</div>
        <div class="seg-info"><div class="seg-name">${m.name}</div><div class="seg-meta">${m.desc}</div></div>
        <div class="lb-val" style="font-size:13px">+${m.fp}</div></div>`; }).join("")}</div>`;
}

function tplSpots() {
  const total = city.spots.length, got = state.spotsVisited.length;
  return `<div class="card"><div class="card-title">${ic("pin", 16)} Spots de ${city.name} · ${got}/${total}</div>
    <div class="seg-meta" style="margin-bottom:8px">Visita estos lugares y sube una foto para ganar FP.</div>
    ${city.spots.map(s => { const on = state.spotsVisited.includes(s.id);
      return `<div class="seg-row">
        <div class="seg-ico ${on ? "earned" : ""}">${ic(on ? "check" : "pin", 20)}</div>
        <div class="seg-info"><div class="seg-name">${s.name}</div><div class="seg-meta">${s.tip}</div></div>
        <button class="mini-save" data-spot="${s.id}">${ic("camera", 14)} ${on ? "Cambiar" : "+" + s.fp}</button></div>`; }).join("")}</div>
    <div class="empty" style="padding:8px"><small>Pronto: spots de otras ciudades y crear los tuyos.</small></div>`;
}
function wireSpots() {
  $$("[data-spot]").forEach(btn => btn.onclick = () => pickSpotPhoto(btn.dataset.spot));
}
function pickSpotPhoto(spotId) {
  const spot = city.spots.find(s => s.id === spotId); if (!spot) return;
  if (!pendingSpotInput) { pendingSpotInput = document.createElement("input"); pendingSpotInput.type = "file"; pendingSpotInput.accept = "image/*"; pendingSpotInput.capture = "environment"; document.body.appendChild(pendingSpotInput); }
  pendingSpotInput.value = "";
  pendingSpotInput.onchange = async () => {
    const f = pendingSpotInput.files[0]; if (!f) return;
    const dataUrl = await resizeImage(f, 700);
    const first = !state.spotsVisited.includes(spotId);
    if (first) { state.spotsVisited.push(spotId); state.fp += spot.fp; sfx.jackpot(); toast(spot.emoji, `¡${spot.name} visitado! +${spot.fp} FP`); }
    if (!state.spotPhotos) state.spotPhotos = {};
    state.spotPhotos[spotId] = dataUrl;
    awardMedals(); saveState(state); renderHudPlayer(); renderGarage("spots");
    refreshSpotMarkers();
  };
  pendingSpotInput.click();
}
function refreshSpotMarkers() { /* marcadores ya en mapa; visual se actualiza al recargar */ }

function tplPremios() {
  const themes = R.THEMES.map(t => { const un = state.unlocked.includes(t.id), eq = state.equippedTheme === t.id;
    return `<div class="unlock ${un ? "" : "locked"} ${eq ? "equipped" : ""}" data-theme="${t.id}" data-un="${un}">
      ${eq ? '<span class="unlock-tag eq">EN USO</span>' : (!un ? '<span class="unlock-tag lk">🔒</span>' : "")}
      <div class="unlock-sw" style="background:linear-gradient(180deg,${t.accent},${t.accent2})"></div>
      <div class="unlock-name">${t.name}</div><div class="unlock-req">${un ? "Tocar para equipar" : t.reqText}</div></div>`; }).join("");
  const c = state.dailyChallenge, pct = c ? Math.min(100, c.progress / c.target * 100) : 0;
  const challenge = c ? `<div class="card"><div class="card-title">${ic("target", 16)} Desafío diario</div>
    <div class="challenge"><div class="seg-ico ${c.done ? "earned" : ""}">${ic(c.done ? "check" : "target", 20)}</div><div class="prog">
      <div class="seg-name" style="font-size:14px">${c.text}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="seg-meta">${c.metric === "dist" ? c.progress.toFixed(1) : Math.round(c.progress)} / ${c.target} · +${c.fp} FP</div></div></div></div>` : "";
  const spin = `<div class="card" style="text-align:center"><div class="card-title" style="justify-content:center">${ic("gift", 16)} La Ruleta</div>
    <div class="seg-meta" style="margin:6px 0 12px">Giros: <b style="color:var(--gold);font-size:17px">${state.spinsAvailable}</b> · faltan <b style="color:var(--ink)">${10 - state.drivesSinceSpin}</b> manejos</div>
    <button class="btn-primary" id="goWheel" ${state.spinsAvailable ? "" : "disabled"}>${state.spinsAvailable ? "GIRAR" : "Sin giros"}</button></div>`;
  return challenge + spin + `<div class="card-title" style="padding:0 4px 8px">${ic("spark", 15)} Temas (${state.unlocked.length}/${R.THEMES.length})</div><div class="unlock-grid">${themes}</div>`;
}
function wirePremios() {
  $$("[data-theme]").forEach(el => el.onclick = () => { if (el.dataset.un !== "true") { sfx.click(); toast("🔒", "Aún bloqueado"); return; } state.equippedTheme = el.dataset.theme; saveState(state); applyTheme(el.dataset.theme); MapView.refreshLiveColor(); sfx.coin(); renderGarage("premios"); renderHudPlayer(); });
  const g = $("#goWheel"); if (g) g.onclick = () => { if (state.spinsAvailable > 0) openWheel(); };
}

function tplZonas() {
  if (!state.zonas.length) return `<div class="empty"><span class="em">${ic("pin", 44)}</span>Sin zonas.<br>Al terminar un manejo, toca «＋ Zona».</div>`;
  return state.zonas.map(z => `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
    <div><div class="seg-name">${ic(z.type === "recta" ? "straight" : "curve", 20)} ${escapeHtml(z.name)}</div>
      <div class="seg-meta">obj ${z.target} km/h · ${z.passes || 0} pasadas · mejor ${z.bestAvg || 0}</div></div>
    <div class="stars">${Array.from({ length: 3 }, (_, i) => `<span class="star ${i < (z.bestStars || 0) ? "on" : ""}">★</span>`).join("")}</div></div>`).join("");
}
function tplHistorial() {
  if (!state.drives.length) return `<div class="empty"><span class="em">${ic("flag", 44)}</span>Sin manejos.<br>¡Sal a la calle!</div>`;
  return state.drives.map(d => `<div class="card"><div style="display:flex;justify-content:space-between">
    <div class="seg-name">${new Date(d.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · ${new Date(d.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
    <div style="color:var(--gold);font-weight:700">+${fmt(d.fp)}</div></div>
    <div class="seg-meta">${d.distanceKm.toFixed(1)} km · ${d.maxSpeed} máx · ${d.stars}⭐ · ${d.segments.length} tramos</div></div>`).join("");
}

// ================= perfil editor =================
function wireProfileEditor() {
  $("#photoFrame").onclick = () => $("#photoInput").click();
  $("#photoInput").onchange = async () => { const f = $("#photoInput").files[0]; if (!f) return; const url = await resizeImage(f, 800); $("#photoFrame").style.backgroundImage = `url('${url}')`; $("#photoPlus").style.display = "none"; $("#photoFrame").dataset.photo = url; };
  $("#profileSave").onclick = saveProfile;
}
function openProfileEditor() {
  const p = state.profile;
  $("#fDriver").value = p.driver || ""; $("#fCarName").value = p.carName || "";
  $("#fBrand").value = p.brand || ""; $("#fModel").value = p.model || ""; $("#fPlate").value = p.plate || "";
  if (p.photo) { $("#photoFrame").style.backgroundImage = `url('${p.photo}')`; $("#photoPlus").style.display = "none"; $("#photoFrame").dataset.photo = p.photo; }
  else { $("#photoFrame").style.backgroundImage = ""; $("#photoPlus").style.display = ""; delete $("#photoFrame").dataset.photo; }
  openOverlay("profile");
}
function saveProfile() {
  state.profile = {
    driver: $("#fDriver").value.trim(), carName: $("#fCarName").value.trim(),
    brand: $("#fBrand").value.trim(), model: $("#fModel").value.trim(),
    plate: $("#fPlate").value.trim(), photo: $("#photoFrame").dataset.photo || state.profile.photo || null,
  };
  saveState(state); sfx.coin(); closeOverlay("profile"); renderGarage("perfil"); toast("✅", "Perfil guardado");
}

// ================= RULETA =================
let wheelRotation = 0, spinning = false;
function wireWheel() { drawWheel(); $("#btnSpin").onclick = doSpin; }
function openWheel() { drawWheel(); $("#wheelSub").textContent = "Giros: " + state.spinsAvailable; $("#wheelResult").textContent = ""; $("#btnSpin").disabled = state.spinsAvailable <= 0; $("#btnSpin").textContent = "GIRAR"; openOverlay("wheel"); }
function drawWheel() {
  const cv = $("#wheelCanvas"); if (!cv) return; const ctx = cv.getContext("2d");
  const n = R.WHEEL_PRIZES.length, cx = cv.width / 2, cy = cv.height / 2, rad = cx - 6, slice = Math.PI * 2 / n;
  ctx.clearRect(0, 0, cv.width, cv.height);
  R.WHEEL_PRIZES.forEach((p, i) => { const st = -Math.PI / 2 + i * slice;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, st, st + slice); ctx.closePath(); ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(st + slice / 2); ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = "700 13px Chakra Petch, sans-serif"; ctx.fillText(p.label, rad - 12, 5); ctx.restore(); });
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fillStyle = "#0a0a0c"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3; ctx.stroke();
}
function doSpin() {
  if (spinning || state.spinsAvailable <= 0) return;
  spinning = true; state.spinsAvailable -= 1; state.spinsUsed = (state.spinsUsed || 0) + 1; saveState(state);
  $("#btnSpin").disabled = true; sfx.spin();
  const n = R.WHEEL_PRIZES.length, sliceDeg = 360 / n, idx = R.pickWheelIndex();
  const jitter = (Math.random() - 0.5) * sliceDeg * 0.6;
  wheelRotation += 360 * 6 - (idx * sliceDeg + sliceDeg / 2) + jitter;
  $("#wheelCanvas").style.transform = `rotate(${wheelRotation}deg)`;
  setTimeout(() => {
    const prize = R.WHEEL_PRIZES[idx]; applyWheelPrize(prize);
    $("#wheelResult").innerHTML = `<span class="r-${prize.rarity}">${prize.rarity.toUpperCase()}</span> · ${prize.label}!`;
    prize.rarity === "legendario" ? sfx.jackpot() : sfx.coin();
    spinning = false; $("#btnSpin").disabled = state.spinsAvailable <= 0; $("#wheelSub").textContent = "Giros: " + state.spinsAvailable;
    awardMedals(); renderHudPlayer();
  }, 4700);
}
function applyWheelPrize(p) { if (p.fp) state.fp += p.fp; if (p.extraSpin) state.spinsAvailable += 1; if (p.xpBoost) state.fp += 200; saveState(state); }

// ================= CIRCUITOS =================
let builderMap = null, builderPoints = [], builderMarkers = [], builderLine = null;
let circuitRun = null, cbTimerId = null;

function wireCircuits() {
  $("#btnNewCircuit").onclick = () => { sfx.click(); openBuilder(); };
  $("#builderUndo").onclick = () => { sfx.click(); builderPoints.pop(); redrawBuilder(); };
  $("#builderClear").onclick = () => { sfx.click(); builderPoints = []; redrawBuilder(); };
  $("#builderSave").onclick = saveCircuit;
  $("#cbCancel").onclick = () => { sfx.click(); cancelCircuitRun(); };
}

function renderCircuits() {
  const b = $("#circuitsBody");
  let html = "";
  if (state.activeChallenge) {
    const c = state.activeChallenge;
    html += `<div class="card challenge-card">
      <div class="card-title" style="color:var(--accent)">${ic("swords", 16)} Reto de ${escapeHtml(c.by)}</div>
      <div class="seg-name">${escapeHtml(c.name)}</div>
      <div class="seg-meta">${(Circ.circuitDistance(c.points) / 1000).toFixed(2)} km · tiempo a batir: <b style="color:var(--gold)">${c.targetSec ? fmtClock(c.targetSec) : "—"}</b></div>
      <div class="circ-actions"><button class="circ-run" data-run-challenge="1">Aceptar reto</button><button class="circ-share" data-decline="1">Descartar</button></div></div>`;
  }
  if (!state.circuits.length && !state.activeChallenge) {
    html += `<div class="empty"><span class="em">${ic("flag", 44)}</span>Aún no tienes circuitos.<br>Toca <b>Crear</b> y traza salida → meta en el mapa.</div>`;
  } else {
    html += state.circuits.map(c => `<div class="card">
      <div class="seg-name" style="display:flex;align-items:center;gap:8px">${ic("flag", 17, "accent")} ${escapeHtml(c.name)}</div>
      <div class="seg-meta">${(c.distanceM / 1000).toFixed(2)} km · ${c.points.length} puntos · mejor: <b style="color:var(--gold)">${c.bestTimeSec ? fmtClock(c.bestTimeSec) : "sin tiempo"}</b></div>
      <div class="circ-actions"><button class="circ-run" data-run="${c.id}">${ic("play", 15)} Correr</button><button class="circ-share" data-share="${c.id}">${ic("share", 15)} Retar amigo</button></div></div>`).join("");
  }
  b.innerHTML = html;
  $$("[data-run]").forEach(el => el.onclick = () => startCircuitRun(state.circuits.find(c => c.id === el.dataset.run)));
  $$("[data-share]").forEach(el => el.onclick = () => shareChallenge(state.circuits.find(c => c.id === el.dataset.share)));
  const rc = $("[data-run-challenge]"); if (rc) rc.onclick = () => startCircuitRun({ ...state.activeChallenge, id: "challenge", bestTimeSec: state.activeChallenge.targetSec, isChallenge: true });
  const dc = $("[data-decline]"); if (dc) dc.onclick = () => { sfx.click(); state.activeChallenge = null; saveState(state); renderCircuits(); };
}

// ---- constructor ----
function openBuilder() {
  openOverlay("builder");
  builderPoints = [];
  setTimeout(() => {
    if (!builderMap) {
      builderMap = L.map("builderMap", { zoomControl: false, attributionControl: false }).setView(city.center, 14);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20 }).addTo(builderMap);
      builderMap.on("click", (e) => { builderPoints.push([e.latlng.lat, e.latlng.lng]); sfx.click(); redrawBuilder(); });
      const m = MapView.getMap(); if (m) builderMap.setView(m.getCenter(), m.getZoom());
    }
    builderMap.invalidateSize();
    redrawBuilder();
  }, 120);
}
function redrawBuilder() {
  if (!builderMap) return;
  builderMarkers.forEach(m => builderMap.removeLayer(m)); builderMarkers = [];
  if (builderLine) { builderMap.removeLayer(builderLine); builderLine = null; }
  builderPoints.forEach((p, i) => {
    const last = i === builderPoints.length - 1 && builderPoints.length > 1;
    const cls = i === 0 ? "start" : (last ? "finish" : "");
    const label = i === 0 ? "S" : (last ? "" : i);
    const icon = L.divIcon({ className: "", html: `<div class="build-pin ${cls}">${label}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    builderMarkers.push(L.marker(p, { icon }).addTo(builderMap));
  });
  if (builderPoints.length > 1) builderLine = L.polyline(builderPoints, { color: "#ff2e3f", weight: 5, opacity: .9, dashArray: "2 8" }).addTo(builderMap);
  $("#builderDist").textContent = (Circ.circuitDistance(builderPoints) / 1000).toFixed(2) + " km";
  $("#builderPts").textContent = builderPoints.length + " puntos";
}
function saveCircuit() {
  if (builderPoints.length < 2) { toast("✋", "Marca al menos salida y meta"); return; }
  const name = prompt("Nombre del circuito:", "Mi circuito"); if (!name) return;
  const c = Circ.makeCircuit(name, builderPoints.slice());
  state.circuits.unshift(c); saveState(state); sfx.coin();
  closeOverlay("builder"); goTab("circuits"); renderCircuits(); toast("🏁", "Circuito guardado");
}

// ---- correr circuito ----
function startCircuitRun(circuit) {
  if (!circuit) return;
  sfx.click();
  circuitRun = { circuit, started: false, startT: 0, finished: false };
  goTab("drive");
  $("#circuitBanner").classList.remove("hidden");
  $("#cbName").textContent = circuit.name;
  $("#cbState").textContent = "Ve a la salida 🏁";
  $("#cbTimer").textContent = circuit.bestTimeSec ? fmtClock(circuit.bestTimeSec) : "0:00";
  MapView.centerOn(circuit.points[0][0], circuit.points[0][1], 16);
  try { if (!tracker.armed && !tracker.recording) { MapView.resetLive(); tracker.arm(false); setArmUI(true); } } catch (e) { toast("⚠️", e.message); }
  toast("🏁", "Colócate en la línea de salida y arranca");
}
function handleCircuitRun(lat, lng) {
  if (!circuitRun || circuitRun.finished) return;
  const pts = circuitRun.circuit.points, start = pts[0], finish = pts[pts.length - 1];
  if (!circuitRun.started) {
    if (Circ.near([lat, lng], start, 45)) {
      circuitRun.started = true; circuitRun.startT = Date.now();
      $("#cbState").textContent = "¡GO! 🏁"; sfx.checkpoint(); toast("🚦", "¡Salida! Cronómetro en marcha");
      cbTimerId = setInterval(() => { $("#cbTimer").textContent = fmtClock((Date.now() - circuitRun.startT) / 1000); }, 200);
    }
  } else if (Circ.near([lat, lng], finish, 45)) {
    finishCircuitRun();
  }
}
function finishCircuitRun() {
  const sec = (Date.now() - circuitRun.startT) / 1000;
  clearInterval(cbTimerId); cbTimerId = null;
  const c = circuitRun.circuit;
  const prevBest = c.bestTimeSec;
  const beat = prevBest == null || sec < prevBest;
  const target = circuitRun.circuit.isChallenge ? circuitRun.circuit.targetSec : prevBest;
  const beatChallenge = circuitRun.circuit.isChallenge && target && sec < target;

  // guarda mejor tiempo en circuitos propios
  const own = state.circuits.find(x => x.id === c.id);
  if (own) { own.attempts = (own.attempts || 0) + 1; if (beat) own.bestTimeSec = Math.round(sec); }
  // FP
  let fp = 300 + (beat ? 200 : 0) + (beatChallenge ? 500 : 0);
  state.fp += fp;
  if (circuitRun.circuit.isChallenge && !beatChallenge && target && sec >= target) { /* perdió el reto */ }
  if (circuitRun.circuit.isChallenge) state.activeChallenge = null;
  saveState(state);
  sfx.jackpot();

  let msg = `Tiempo: ${fmtClock(sec)} · +${fp} FP`;
  if (beatChallenge) msg = `¡GANASTE EL RETO! ${fmtClock(sec)} vs ${fmtClock(target)} · +${fp} FP`;
  else if (circuitRun.circuit.isChallenge && target) msg = `No alcanzó: ${fmtClock(sec)} vs ${fmtClock(target)}. +${fp} FP`;
  else if (beat && prevBest != null) msg = `¡NUEVO RÉCORD! ${fmtClock(sec)} · +${fp} FP`;
  queueModal(circuitRun.circuit.isChallenge ? "⚔️" : "🏁", "CIRCUITO COMPLETO", msg);

  tracker.stop(); setArmUI(false); setRecUI(false); MapView.fogLive(null);
  $("#circuitBanner").classList.add("hidden");
  circuitRun = null;
  renderHudPlayer(); flushModals();
}
function cancelCircuitRun() {
  if (cbTimerId) clearInterval(cbTimerId); cbTimerId = null;
  try { tracker.stop(); } catch (e) {}
  setArmUI(false); setRecUI(false);
  $("#circuitBanner").classList.add("hidden");
  circuitRun = null;
  toast("✖️", "Circuito cancelado");
}

// ---- retos por link ----
async function shareChallenge(circuit) {
  if (!circuit) return; sfx.click();
  const code = Circ.encodeChallenge(circuit, circuit.bestTimeSec, state.profile.driver || "Un piloto");
  const url = location.href.split("#")[0] + "#c=" + code;
  const t = circuit.bestTimeSec ? ` Batir mi tiempo: ${fmtClock(circuit.bestTimeSec)}.` : "";
  const text = `⚔️ Te reto en Fastest: circuito "${circuit.name}".${t} Abre el link e intenta ganarme: ${url}`;
  try { if (navigator.share) { await navigator.share({ title: "Reto Fastest", text, url }); return; } } catch (e) {}
  try { await navigator.clipboard.writeText(text); toast("🔗", "Reto copiado — pégalo en WhatsApp"); }
  catch (e) { prompt("Comparte este reto:", url); }
}
function importChallengeFromUrl() {
  const h = location.hash || "";
  const m = h.match(/[#&]c=([^&]+)/);
  if (!m) return;
  const ch = Circ.decodeChallenge(m[1]);
  history.replaceState(null, "", location.pathname + location.search);
  if (!ch) return;
  state.activeChallenge = ch; saveState(state);
  setTimeout(() => { queueModal("⚔️", "¡TE RETARON!", `${ch.by} te reta en "${ch.name}". Ábrelo en Circuitos y acepta.`); flushModals(); }, 800);
}

// ================= tema + util =================
function applyTheme(id) {
  const t = R.themeById(id), r = document.documentElement.style;
  r.setProperty("--accent", t.accent); r.setProperty("--accent-2", t.accent2); r.setProperty("--accent-glow", hexA(t.accent, .5));
}
function ensureDailyChallenge() { const today = dayKey(); if (!state.dailyChallenge || state.dailyChallenge.day !== today) { state.dailyChallenge = R.rollDailyChallenge(today); saveState(state); } }
function updateChallenge(drive) {
  const c = state.dailyChallenge; if (!c || c.done) return;
  const add = { dist: drive.distanceKm, stars: drive.stars, top: drive.maxSpeed, segs: drive.segments.length, combo: drive.maxCombo }[c.metric] || 0;
  if (c.metric === "top" || c.metric === "combo") c.progress = Math.max(c.progress, add); else c.progress += add;
  if (c.progress >= c.target) { c.done = true; state.fp += c.fp; sfx.coin(); queueModal(c.emoji, "¡DESAFÍO COMPLETO!", c.text + " · +" + c.fp + " FP"); }
}

function resizeImage(file, max) {
  return new Promise((res) => {
    const img = new Image(); const rd = new FileReader();
    rd.onload = () => { img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas"); cv.width = img.width * sc; cv.height = img.height * sc;
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      res(cv.toDataURL("image/jpeg", 0.82));
    }; img.src = rd.result; };
    rd.readAsDataURL(file);
  });
}
function toast(em, msg) { const el = document.createElement("div"); el.className = "toast"; el.innerHTML = `<span class="em">${em}</span> ${msg}`; $("#toastStack").appendChild(el); setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; setTimeout(() => el.remove(), 400); }, 2800); }
function fmt(n) { return Math.round(n).toLocaleString("es-MX"); }
function fmtTime(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
function fmtClock(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60), d = Math.floor((sec * 10) % 10); return `${m}:${String(s).padStart(2, "0")}.${d}`; }
function dayKey(ts) { const d = new Date(ts || Date.now()); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function hexA(hex, a) { const h = hex.replace("#", ""); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
