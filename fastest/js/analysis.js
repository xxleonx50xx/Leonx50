// ================= Análisis del manejo: tramos, estrellas, zonas =================
import { haversine, bearing } from "./tracker.js";

// objetivos por defecto (km/h) cuando el tramo no pertenece a una zona guardada
const DEFAULT_TARGET = { recta: 55, curva: 35 };

function angleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
function mean(arr) { return arr.reduce((s, x) => s + x, 0) / (arr.length || 1); }
function std(arr) { const m = mean(arr); return Math.sqrt(mean(arr.map(x => (x - m) ** 2))); }

// Divide la ruta en tramos clasificados como "recta" o "curva".
export function segmentDrive(points) {
  const pts = points.filter((p, i) => i === 0 || haversine(points[i - 1], p) > 1);
  if (pts.length < 4) return [];

  // curvatura local por punto (cambio de rumbo por metro)
  const turning = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return 0;
    const b1 = bearing(pts[i - 1], p);
    const b2 = bearing(p, pts[i + 1]);
    const d = haversine(pts[i - 1], p) + haversine(p, pts[i + 1]);
    return d > 0 ? angleDiff(b1, b2) / (d / 100) : 0; // grados por 100 m
  });

  // suavizado simple (media móvil de 3)
  const sm = turning.map((_, i) => mean(turning.slice(Math.max(0, i - 1), i + 2)));
  const CURVE_TH = 18; // grados/100m para considerarse curva

  const rawSegs = [];
  let cur = { type: sm[1] > CURVE_TH ? "curva" : "recta", start: 0 };
  for (let i = 1; i < pts.length; i++) {
    const t = sm[i] > CURVE_TH ? "curva" : "recta";
    if (t !== cur.type) { cur.end = i; rawSegs.push(cur); cur = { type: t, start: i }; }
  }
  cur.end = pts.length - 1; rawSegs.push(cur);

  // construye tramos con métricas y fusiona los muy cortos con el vecino
  let segs = rawSegs.map(s => buildSeg(pts, s.start, s.end, s.type)).filter(Boolean);
  segs = mergeShort(segs, pts);
  return segs;
}

function buildSeg(pts, start, end, type) {
  const slice = pts.slice(start, end + 1);
  if (slice.length < 2) return null;
  let dist = 0;
  for (let i = 1; i < slice.length; i++) dist += haversine(slice[i - 1], slice[i]);
  if (dist < 8) return null;
  const speeds = slice.map(p => p.speed);
  const avg = mean(speeds), max = Math.max(...speeds), sd = std(speeds);
  return {
    type,
    coords: slice.map(p => [p.lat, p.lng]),
    startPoint: { lat: slice[0].lat, lng: slice[0].lng },
    endPoint: { lat: slice[slice.length - 1].lat, lng: slice[slice.length - 1].lng },
    bearing: bearing(slice[0], slice[slice.length - 1]),
    distanceM: dist,
    avgSpeed: Math.round(avg),
    maxSpeed: Math.round(max),
    consistency: avg > 0 ? Math.max(0, 1 - sd / avg) : 0,
  };
}

function mergeShort(segs, pts) {
  const MIN = 90; // m
  const out = [];
  for (const s of segs) {
    if (out.length && s.distanceM < MIN && out[out.length - 1].type === s.type) {
      // fusiona con el anterior del mismo tipo
      const prev = out.pop();
      const merged = buildSeg(
        pts,
        pts.findIndex(p => p.lat === prev.startPoint.lat && p.lng === prev.startPoint.lng),
        pts.findIndex(p => p.lat === s.endPoint.lat && p.lng === s.endPoint.lng),
        prev.type
      );
      out.push(merged || prev);
    } else {
      out.push(s);
    }
  }
  return out.filter(s => s.distanceM >= 40);
}

// Estrellas 1–3 según objetivo (rectas = velocidad, curvas = línea limpia)
export function scoreStars(seg, target) {
  const tgt = target || DEFAULT_TARGET[seg.type];
  if (seg.type === "recta") {
    const r = seg.avgSpeed / tgt;
    if (r >= 1.15) return 3;
    if (r >= 0.95) return 2;
    if (r >= 0.70) return 1;
    return 0;
  } else {
    // curva: premia la constancia (línea suave) y velocidad razonable
    const c = seg.consistency;
    if (c >= 0.85 && seg.avgSpeed >= tgt * 0.9) return 3;
    if (c >= 0.70 && seg.avgSpeed >= tgt * 0.65) return 2;
    if (seg.avgSpeed >= tgt * 0.55) return 1;
    return 0;
  }
}

// ¿Este tramo coincide con una zona guardada? (mismo inicio y rumbo)
export function matchZona(seg, zonas) {
  for (const z of zonas) {
    const near = haversine(seg.startPoint, z.startPoint) < 70;
    const sameDir = angleDiff(seg.bearing, z.bearing) < 50;
    if (near && sameDir && z.type === seg.type) return z;
  }
  return null;
}

// Analiza el manejo completo -> tramos con nombre, estrellas y récords
export function analyzeDrive(drive, zonas) {
  const rawSegs = segmentDrive(drive.points);
  let rectaN = 0, curvaN = 0, newRecords = 0;
  const segments = rawSegs.map(seg => {
    const zona = matchZona(seg, zonas);
    const target = zona ? zona.target : DEFAULT_TARGET[seg.type];
    const stars = scoreStars(seg, target);
    let name, isRecord = false;
    if (zona) {
      name = zona.name;
      if (stars > (zona.bestStars || 0) || seg.avgSpeed > (zona.bestAvg || 0)) { isRecord = true; newRecords++; }
    } else {
      name = seg.type === "recta" ? `Recta ${++rectaN}` : `Curva ${++curvaN}`;
    }
    return { ...seg, name, target, stars, zonaId: zona ? zona.id : null, isRecord };
  });
  return { segments, newRecords };
}
