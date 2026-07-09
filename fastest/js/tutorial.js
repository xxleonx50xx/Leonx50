// ================= Tutorial simulado (Cañadas → La Primavera, Culiacán) =================
// Anima un carro por una ruta real de Culiacán mientras explica la app.

// Waypoints aproximados de norte de Culiacán hacia La Primavera (SO).
const WAYPOINTS = [
  [24.8330, -107.4180], // Cañadas (casa) - norte
  [24.8240, -107.4210],
  [24.8140, -107.4260],
  [24.8050, -107.4320],
  [24.7990, -107.4400],
  [24.7975, -107.4500],
  [24.7968, -107.4600],
  [24.7963, -107.4688], // La Primavera
];

const CAPTIONS = [
  { at: 0.00, html: "🏁 <b>Bienvenido a Fastest.</b> Vas a hacer un recorrido de práctica desde tu casa en <b>Cañadas</b> hacia <b>La Primavera</b>." },
  { at: 0.14, html: "⚡ Al pasar de <b>10 km/h</b>, Fastest arranca solo y muestra tu <b>velocidad en vivo</b>." },
  { at: 0.34, html: "🗺️ Mira el mapa: se va <b>desbloqueando</b> por donde pasas. Lo gris es territorio sin explorar." },
  { at: 0.55, html: "↩️ Cada <b>recta y curva</b> se guarda por separado y se califica con <b>estrellas</b> ⭐." },
  { at: 0.78, html: "🔗 Mantén velocidad para subir tu <b>combo</b> y ganar más puntos (FP)." },
  { at: 0.95, html: "🏆 Al terminar verás tu <b>resumen</b>. ¡Listo, ya sabes lo básico!" },
];

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function bearing(a, b) {
  const y = Math.sin((b[1] - a[1]) * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180);
  const x = Math.cos(a[0] * Math.PI / 180) * Math.sin(b[0] * Math.PI / 180) -
            Math.sin(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.cos((b[1] - a[1]) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Construye una polilínea densa interpolando los waypoints.
function densify(steps) {
  const pts = [];
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    for (let s = 0; s < steps; s++) pts.push(lerp(WAYPOINTS[i], WAYPOINTS[i + 1], s / steps));
  }
  pts.push(WAYPOINTS[WAYPOINTS.length - 1]);
  return pts;
}

export function runTutorial(cb) {
  const path = densify(14);
  const n = path.length;
  let i = 0, capIdx = 0, stopped = false;
  cb.onStart && cb.onStart(path);

  const timer = setInterval(() => {
    if (stopped) return;
    const t = i / (n - 1);
    const cur = path[i];
    const nxt = path[Math.min(i + 1, n - 1)];
    const hd = bearing(cur, nxt);
    // perfil de velocidad: acelera, sube en rectas, baja en curvas del final
    const speed = Math.round(28 + 55 * Math.sin(Math.PI * Math.min(1, t * 1.05)) + (t > 0.5 ? 18 : 0));

    if (capIdx < CAPTIONS.length && t >= CAPTIONS[capIdx].at) {
      cb.onCaption && cb.onCaption(CAPTIONS[capIdx].html);
      capIdx++;
    }
    cb.onStep && cb.onStep({ lat: cur[0], lng: cur[1], speed: Math.max(0, speed), heading: hd, t });

    i++;
    if (i >= n) { clearInterval(timer); cb.onDone && cb.onDone(path); }
  }, 130);

  return { skip() { stopped = true; clearInterval(timer); cb.onDone && cb.onDone(path); } };
}
