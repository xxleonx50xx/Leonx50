# 🏁 Fastest

Tu ciudad es la pista. **Fastest** mide tu velocidad promedio en las rectas y curvas de tu ciudad mientras manejas, divide tu ruta en tramos, y te premia con estrellas, niveles y recompensas estilo videojuego (inspirado en Forza Horizon).

Es una **PWA (Progressive Web App)**: se instala directo en tu iPhone desde Safari, sin App Store y sin Mac. Se edita 100% desde la web.

---

## 📲 Cómo instalarla en tu iPhone

1. Publica la carpeta `fastest/` (ver **Deploy** abajo) — obtendrás una URL `https://…`.
2. Abre esa URL en **Safari** (tiene que ser Safari, no Chrome).
3. Toca el botón **Compartir** → **Agregar a pantalla de inicio**.
4. Ábrela desde el ícono ⚡ que aparece. Ya corre a pantalla completa como app nativa.
5. La primera vez te pedirá permiso de **Ubicación** → elige **"Al usar la app" / Permitir**.

> ⚠️ **Requiere HTTPS.** El GPS del navegador solo funciona en sitios seguros (`https://`). GitHub Pages ya da HTTPS gratis.

---

## 🚀 Deploy (GitHub Pages, gratis)

Este repo incluye un workflow que publica automáticamente la carpeta `fastest/`.

1. En GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Haz push a la rama principal. El workflow `.github/workflows/deploy-fastest.yml` publica el sitio.
3. Tu URL será algo como: `https://<usuario>.github.io/<repo>/`

**Probar localmente** (en tu compu):
```bash
cd fastest
python3 -m http.server 8080
# abre http://localhost:8080
```
(En escritorio el GPS puede ser aproximado; la velocidad real se ve en el teléfono moviéndote.)

---

## 🎮 Cómo funciona

- **Detección automática:** toca ▶, ponte en marcha y al superar **10 km/h** empieza a registrar solo.
- **Velocímetro en vivo** con arco de color y traza tu ruta en el mapa.
- **Tramos automáticos:** al terminar, la ruta se divide en **rectas** y **curvas**.
- **Estrellas ⭐ (1–3):**
  - *Rectas* → por velocidad promedio vs. el objetivo.
  - *Curvas* → por **línea limpia** (constancia), no por ir rápido. Más seguro y más satisfactorio.
- **Zonas guardadas:** convierte cualquier recta/curva en una "Zona" con tu propio objetivo. Cada vez que vuelvas a pasar, mejora tu marca y compite contra ti mismo.

## 🏆 Sistema de recompensas "Velocidad Total"

| Elemento | Qué hace |
|---|---|
| **FP (Fastest Points)** | Moneda: ganas por km, estrellas, velocidad punta y récords. |
| **Niveles y XP** | Barra de experiencia; subir de nivel desbloquea temas. |
| **Rangos** | Novato → Veloz → Piloto → As → Leyenda → **Fastest**. |
| **Combo** | Mantén velocidad y sube el multiplicador (x1–x5). |
| **Racha diaria 🔥** | Días seguidos manejando. |
| **Desafío diario** | Reto que cambia cada día (+FP al completarlo). |
| **Temas neón** | 8 skins que cambian el color del HUD, se desbloquean por logros. |
| **🎡 La Ruleta** | Cada **10 manejos** ganas un giro con premios de distinta rareza (común → legendario, incluye JACKPOT). |

---

## 🗂️ Estructura

```
fastest/
├── index.html          # estructura y pantallas
├── manifest.webmanifest# metadatos PWA
├── sw.js               # service worker (instalable/offline shell)
├── css/styles.css      # tema Forza (neón + glassmorphism)
├── icons/              # íconos de la app
└── js/
    ├── app.js          # controlador principal (HUD, recompensas, garage, ruleta)
    ├── tracker.js      # GPS + cálculo de velocidad
    ├── analysis.js     # división en rectas/curvas + estrellas
    ├── rewards.js      # niveles, rangos, temas, ruleta, desafíos
    ├── map.js          # mapa (Leaflet + OpenStreetMap)
    └── storage.js      # guardado local
```

---

## 🔒 Nota de seguridad

Fastest premia la **constancia y la línea limpia**, no manejar peligrosamente. Respeta siempre los límites y las leyes de tránsito. Usa un soporte para el teléfono; **nunca** lo manipules manejando.

## 🧭 Limitaciones conocidas (v1)

- iOS **suspende el GPS con la pantalla apagada** en PWAs. Mantén la pantalla encendida durante el manejo (idealmente con el teléfono en un soporte y cargando).
- Las notificaciones push (como las del ejemplo) requieren un backend; van en una versión futura.
- Los mapas usan tiles gratuitos de OpenStreetMap/CARTO (requieren internet).
