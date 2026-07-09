# 🏁 Fastest

Tu ciudad es la pista. **Fastest** mide tu velocidad mientras manejas, **desbloquea el mapa** de tu ciudad conforme lo recorres (estilo *fog of war*), divide tu ruta en rectas y curvas, y te premia con un sistema de videojuego: FP, niveles, medallas, spots, ruleta y ranking.

Es una **PWA (Progressive Web App)**: se instala directo en tu iPhone desde Safari, sin App Store y sin Mac. Se edita 100% desde la web.

---

## 📲 Instalar en iPhone
1. Publica la carpeta `fastest/` (ver **Deploy**) → obtienes una URL `https://…`.
2. Abre esa URL en **Safari** → botón **Compartir** → **Agregar a inicio**.
3. Ábrela desde el ícono ⚡, y da permiso de **Ubicación** → *Al usar la app*.

> ⚠️ Requiere **HTTPS** (para el GPS). GitHub Pages lo da gratis. Mantén la pantalla encendida al manejar (iOS apaga el GPS de PWAs con la pantalla apagada).

---

## 🚀 Deploy (GitHub Pages)
Incluye un workflow que publica `fastest/` automáticamente.
1. GitHub → **Settings → Pages → Source: GitHub Actions**.
2. Haz push → se publica en `https://<usuario>.github.io/<repo>/`.

Local: `cd fastest && python3 -m http.server 8080`

---

## 🎮 Cómo funciona
- **Detección automática:** toca ▶, ponte en marcha; al pasar **10 km/h** registra solo.
- **Velocímetro en vivo** + traza tu ruta. El carro se muestra como un **Skyline R34 lateral**.
- **Niebla de guerra 🗺️:** el mapa empieza gris y se **revela** por donde pasas. Un contador muestra tu % explorado.
- **Tramos automáticos:** rectas y curvas, cada una con **estrellas ⭐**
  - Rectas → por velocidad vs. objetivo. Curvas → por **línea limpia** (constancia).
- **Zonas guardadas:** guarda una recta/curva con tu objetivo y compite contra ti mismo.

## 🏆 Recompensas
| Elemento | Qué hace |
|---|---|
| **FP** | Moneda: por km, estrellas, combo, velocidad y récords. |
| **Niveles / Rangos** | Novato → Veloz → Piloto → As → Leyenda → **Fastest**. |
| **Medallas** 🎖️ | 16 logros al estilo arcade (Ronda 10, Sin Piedad, Cartógrafo…). |
| **Spots** 📸 | Lugares icónicos de Culiacán (La Lomita, Catedral, Las Riberas…). Súbeles foto y gana FP. |
| **Skills** 🧲 | Mejoras que compras con FP (Imán de FP, Turbo XP, Combo Rápido, Radar). |
| **Cofre diario** 🎁 | Recompensa sorpresa cada día. |
| **Desafío diario** | Reto que cambia a diario. |
| **La Ruleta** 🎡 | Cada 10 manejos, giro con premios (común → JACKPOT legendario). |
| **Sonidos** 🔊 | Efectos sintetizados tipo arcade al subir de nivel, medallas y monedas. |
| **Ranking** | Top Speed, Tiempo, Distancia y Promedio (contra rivales locales por ahora). |
| **Perfil** | Nombre de piloto, marca, modelo, placa y **foto de tu carro**. |

## 🧭 Estructura (UI)
Menú inferior fijo con 3 secciones:
- **Conducir** — mapa + HUD + niebla + spots.
- **Ranking** — tablas por categoría + invitar amigos.
- **Garage** — Perfil · Medallas · Spots · Premios · Zonas · Historial.

Además, un **tutorial** simulado (Cañadas → La Primavera) corre la primera vez para enseñar la app.

---

## 🗂️ Archivos
```
fastest/
├── index.html · manifest.webmanifest · sw.js
├── css/styles.css            # tema negro/rojo metálico + glass
├── icons/                    # ícono (chevrones rojos)
└── js/
    ├── app.js                # controlador principal
    ├── tracker.js            # GPS + velocidad
    ├── analysis.js           # rectas/curvas + estrellas
    ├── rewards.js            # niveles, temas, ruleta, skills, cofre
    ├── fog.js                # niebla de guerra
    ├── map.js                # mapa Leaflet + carro R34
    ├── tutorial.js           # recorrido de práctica
    ├── spots.js              # spots de la ciudad
    ├── achievements.js       # medallas
    ├── leaderboard.js        # ranking (rivales)
    ├── sfx.js                # sonidos sintetizados
    └── storage.js            # guardado local
```

## 🔜 Próximo (roadmap)
- **Constructor de circuitos** (inicio → fin con waypoints) y **retos a amigos** por tiempo.
- **Ranking online real** entre amigos → requiere backend (p. ej. Supabase, capa gratis).
- Más ciudades y spots creados por el usuario.

## 🔒 Seguridad
Fastest premia la **constancia y la línea limpia**, no manejar peligrosamente. Respeta límites y leyes de tránsito. Usa un soporte; **nunca** manipules el teléfono manejando.
