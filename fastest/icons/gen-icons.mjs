// Genera los íconos PNG de Fastest (negro metálico + chevrones rojos) en Chromium.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const draw = (size, maskable) => `
  const c = document.createElement('canvas'); c.width=${size}; c.height=${size};
  const x = c.getContext('2d'); const s=${size};
  // fondo negro metálico
  const g = x.createLinearGradient(0,0,s,s);
  g.addColorStop(0,'#1a1c20'); g.addColorStop(.5,'#0d0e11'); g.addColorStop(1,'#050506');
  x.fillStyle=g;
  ${maskable ? `x.fillRect(0,0,s,s);` : `const r=s*0.22; x.beginPath(); x.roundRect(0,0,s,s,r); x.fill();`}
  // brillo superior sutil
  const sh = x.createLinearGradient(0,0,0,s*0.5);
  sh.addColorStop(0,'rgba(255,255,255,0.10)'); sh.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=sh; ${maskable ? `x.fillRect(0,0,s,s*0.5);` : `x.beginPath(); x.roundRect(0,0,s,s*0.5,[s*0.22,s*0.22,0,0]); x.fill();`}
  // chevrones rojos de velocidad
  x.translate(s*0.5, s*0.5);
  const u = s*(${maskable ? 0.052 : 0.061});
  const chevron = (ox, col) => {
    x.beginPath();
    x.moveTo(ox-1.6*u, -2.4*u); x.lineTo(ox+0.9*u, -2.4*u); x.lineTo(ox+2.5*u, 0);
    x.lineTo(ox+0.9*u, 2.4*u); x.lineTo(ox-1.6*u, 2.4*u); x.lineTo(ox, 0); x.closePath();
    x.fillStyle=col; x.fill();
  };
  x.shadowColor='rgba(255,46,63,.65)'; x.shadowBlur=s*0.03;
  chevron(-2.0*u, '#8a0d18');
  chevron(-0.2*u, '#e01d2a');
  chevron( 1.6*u, '#ff3b48');
  return c.toDataURL('image/png');
`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
const jobs = [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["icon-180.png", 180, false], ["icon-maskable-512.png", 512, true]];
for (const [name, size, mask] of jobs) {
  const dataUrl = await page.evaluate(new Function(draw(size, mask)));
  writeFileSync(new URL("./" + name, import.meta.url), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("✔", name);
}
await browser.close();
