# 🌿 Cuadra

App de finanzas personales en **negro y esmeralda** para trabajar **cuadrando**: lo que dice la app contra lo que dice tu banco, tus tarjetas y tu cartera.

Es una **PWA**: se instala en el iPhone desde Safari, funciona sin internet y tus datos se guardan **solo en tu teléfono**.

---

## 📲 Instalar en iPhone
1. Abre `https://<usuario>.github.io/<repo>/cuadra/` en **Safari**.
2. **Compartir → Agregar a inicio**.
3. Ábrela desde el ícono verde **=**.
4. Para cargar tus datos iniciales: en la bienvenida toca **“Ya tengo un respaldo”** y elige el archivo `.json`.

> 💾 Haz un respaldo seguido (**Más → Respaldo**) y guárdalo en iCloud Drive. Si borras la app del inicio, se borran sus datos.

---

## 🧭 Qué hace

| Sección | Para qué |
|---|---|
| **Inicio** | Patrimonio neto, aviso de cuentas sin cuadrar, corte con tu pareja, tu gasto real del mes, próximos cortes y pagos de tarjetas, fondo común y metas. |
| **Cuentas** | Débito, crédito, efectivo, fondo común y ahorro. En crédito ves la deuda total, la deuda sin MSI, lo que falta de MSI, el disponible y las fechas de corte y pago. |
| **Cuadrar** | Capturas el saldo real del banco (o el **crédito disponible**). Si no cuadra, la app registra un **ajuste** por la diferencia. Para efectivo hay **contador de billetes**. |
| **＋ Registro rápido** | Teclado numérico grande → cuenta (con su logo) → categoría → Guardar. 3–4 toques. Pestañas Gasto / Ingreso / Casa, botón “Dividir con Liz”, fecha y “Más opciones”. El logo del comercio aparece al escribir (Oxxo, Walmart, Uber…). |
| **Casa** | Gastos de casa divididos con tu pareja (60/40 por defecto): quién pagó (yo, ella o el fondo), cuánto le toca a cada quien, presupuesto por categoría y saldo del mes, que se suma solo al corte. |
| **Escritorio** | En pantallas anchas: barra lateral, tablas ordenables y una fila para capturar gastos directo en la tabla de Movimientos (Enter para guardar). Tecla **N** = registrar gasto. |
| **Personas** | Deudas de familia y amigos en ambos sentidos (le presté, me pagó, me debe, le debo…). Opcional: **plan de pagos** (ej. $811 por quincena) que te dice si va al corriente o atrasado. |
| **Cortes** | Cada semana (o cada 2 semanas, o cada mes) suma su parte de los gastos compartidos, lo que es 100% suyo, sus MSI y lo que ella pagó por ti. Al **cerrar el corte** registras el pago y lo que falte pasa al siguiente. La fecha de cierre se puede mover. |
| **Fondo común** | Una cuenta tuya a donde ambos aportan. Tiene presupuesto de la casa (renta, súper, servicios…), cuánto le toca aportar a cada quien según su % y cuánto se ha gastado por categoría. |
| **Metas** | Medidas por aportaciones, por el saldo de una cuenta o por tu patrimonio neto. Si pones fecha, calcula cuánto necesitas por mes. |
| **MSI** | La mensualidad en la que vas se calcula **sola** con la fecha de la primera mensualidad. Una compra a MSI se puede cargar a otra persona (ej. el carro de papá) o compartir con tu pareja. |

### Reglas que evitan los errores del Excel
- **Un pago a tarjeta es una transferencia, no un gasto.** Ya no se cuenta doble.
- **“Gasté (mi parte)”** solo cuenta lo que te toca a ti: descuenta la parte de otros e incluye tu parte de las mensualidades MSI.
- Las **aportaciones al fondo** y los **reembolsos** no cuentan como ingreso.
- Los montos aceptan operaciones simples: `150+179+150`.

---

## 🗂️ Archivos
```
cuadra/
├── index.html            # estructura + barra inferior
├── css/styles.css        # tema negro/verde
├── js/
│   ├── app.js            # rutas, acciones, respaldo/CSV
│   ├── store.js          # estado y localStorage
│   ├── calc.js           # saldos, MSI, personas, cortes, fondo, metas
│   ├── views.js          # pantallas
│   ├── forms.js          # formularios (hojas inferiores)
│   ├── ui.js             # componentes
│   ├── quick.js          # registro rápido (teclado numérico)
│   ├── logos.js          # íconos y detección de marcas
│   ├── icons.js          # íconos Lucide (ISC) — generado
│   ├── brands.js         # logos Simple Icons (CC0) + insignias de color — generado
│   └── format.js         # dinero y fechas
├── sw.js                 # offline
├── manifest.webmanifest
└── icons/                # gen-icons.mjs los genera
```

Local: `cd cuadra && python3 -m http.server 8080` → http://localhost:8080

Deploy: el workflow de GitHub Pages publica Fastest en la raíz y Cuadra en `/cuadra/`.

## 🔜 Siguientes pasos posibles
- Sincronizar en la nube (p. ej. Supabase) para usarla en varios dispositivos y que Liz vea los cortes.
- Importar movimientos históricos del Excel.
- Gráficas por mes y por categoría.

## ©️ Íconos y logos
- Íconos de línea: [Lucide](https://lucide.dev) (licencia ISC).
- Logos de marcas: [Simple Icons](https://simpleicons.org) (CC0) cuando existen (Amex, HSBC, Nu, Uber, Netflix, Spotify, Starbucks…). Para marcas que no están ahí (BBVA, OXXO, Walmart, Rappi, Plata…) se usa una insignia con el color de la marca. Las marcas pertenecen a sus dueños; se usan solo para identificar cuentas y comercios.
