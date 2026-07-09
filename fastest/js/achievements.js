// ================= Medallas / Logros (estilo arcade) =================
// Cada medalla evalúa el estado del jugador. Al cumplirse, se otorga una vez.
export const MEDALS = [
  { id: "primera_sangre", name: "Primer Arranque", emoji: "🩸", fp: 100, desc: "Completa tu primer manejo", test: s => s.totalDrives >= 1 },
  { id: "km_cero",        name: "Kilómetro Cero",  emoji: "🛣️", fp: 150, desc: "Recorre 10 km en total",   test: s => s.totalDistance >= 10 },
  { id: "maraton",        name: "Maratón",         emoji: "🏁", fp: 400, desc: "Recorre 100 km en total",  test: s => s.totalDistance >= 100 },
  { id: "ronda_10",       name: "Ronda 10",        emoji: "🧟", fp: 300, desc: "Completa 10 manejos",      test: s => s.totalDrives >= 10 },
  { id: "ronda_25",       name: "Ronda 25",        emoji: "☠️", fp: 600, desc: "Completa 25 manejos",      test: s => s.totalDrives >= 25 },
  { id: "velocista",      name: "Velocista",       emoji: "💨", fp: 250, desc: "Alcanza 100 km/h",         test: s => s.bestTopSpeed >= 100 },
  { id: "sin_piedad",     name: "Sin Piedad",      emoji: "🔥", fp: 500, desc: "Alcanza 140 km/h",         test: s => s.bestTopSpeed >= 140 },
  { id: "estrellado",     name: "Estrellado",      emoji: "⭐", fp: 300, desc: "Junta 25 estrellas",       test: s => s.totalStars >= 25 },
  { id: "perfeccionista", name: "Perfeccionista",  emoji: "💯", fp: 350, desc: "Junta 60 estrellas",       test: s => s.totalStars >= 60 },
  { id: "explorador",     name: "Explorador",      emoji: "🧭", fp: 250, desc: "Desbloquea 50 celdas del mapa", test: s => (s.explored?.length || 0) >= 50 },
  { id: "cartografo",     name: "Cartógrafo",      emoji: "🗺️", fp: 700, desc: "Desbloquea 250 celdas",    test: s => (s.explored?.length || 0) >= 250 },
  { id: "turista",        name: "Turista",         emoji: "📸", fp: 300, desc: "Visita 3 spots de tu ciudad", test: s => (s.spotsVisited?.length || 0) >= 3 },
  { id: "coleccionista",  name: "Coleccionista",   emoji: "🏆", fp: 800, desc: "Visita todos los spots",   test: s => (s.spotsVisited?.length || 0) >= (s._spotTotal || 99) },
  { id: "racha_7",        name: "Imparable",       emoji: "🔗", fp: 500, desc: "Racha de 7 días",          test: s => s.streak >= 7 },
  { id: "afortunado",     name: "Afortunado",      emoji: "🎰", fp: 200, desc: "Gira la ruleta",           test: s => s.spinsUsed >= 1 },
  { id: "leyenda",        name: "Leyenda",         emoji: "👑", fp: 1500, desc: "Llega al nivel 20",        test: s => s.level >= 20 },
];

// Devuelve las medallas recién ganadas y marca en state.medals.
export function checkMedals(state) {
  if (!state.medals) state.medals = [];
  const earned = [];
  for (const m of MEDALS) {
    if (state.medals.includes(m.id)) continue;
    if (m.test(state)) { state.medals.push(m.id); earned.push(m); }
  }
  return earned;
}
