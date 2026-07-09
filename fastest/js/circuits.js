// ================= Circuitos y retos =================
// Un circuito es una ruta (salida → puntos → meta). Los retos se comparten
// dentro del link: el circuito y el tiempo a batir van codificados en la URL,
// así funcionan entre amigos sin servidor.
import { haversine } from "./tracker.js";

export function circuitDistance(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine({ lat: points[i - 1][0], lng: points[i - 1][1] }, { lat: points[i][0], lng: points[i][1] });
  return d;
}
export function near(a, b, radius) { return haversine({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) < radius; }

// --- codificación URL-safe (base64) ---
function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(str)));
}

// reto = { n: nombre, p: puntos, t: tiempoObjetivoSeg, by: retador }
export function encodeChallenge(circuit, targetSec, byName) {
  const payload = {
    n: circuit.name,
    p: circuit.points.map(pt => [+pt[0].toFixed(5), +pt[1].toFixed(5)]),
    t: Math.round(targetSec || circuit.bestTimeSec || 0),
    by: (byName || "Un piloto").slice(0, 20),
  };
  return b64urlEncode(JSON.stringify(payload));
}
export function decodeChallenge(code) {
  try {
    const o = JSON.parse(b64urlDecode(code));
    if (!o.p || !Array.isArray(o.p) || o.p.length < 2) return null;
    return { name: o.n || "Circuito", points: o.p, targetSec: o.t || 0, by: o.by || "Un piloto" };
  } catch (e) { return null; }
}

export function makeCircuit(name, points) {
  return { id: "c" + Date.now(), name, points, distanceM: circuitDistance(points), bestTimeSec: null, attempts: 0, createdAt: Date.now() };
}
