// Genera los íconos PNG de Cuadra (negro + esmeralda, signo "=" de cuadrar) en Chromium.
// Uso: node cuadra/icons/gen-icons.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { writeFileSync } from "node:fs";

const draw = (size, maskable) => `
  const c = document.createElement('canvas'); c.width=${size}; c.height=${size};
  const x = c.getContext('2d'); const s=${size};
  x.fillStyle='#0a0b09';
  ${maskable ? `x.fillRect(0,0,s,s);` : `x.beginPath(); x.roundRect(0,0,s,s,s*0.22); x.fill();`}
  const k = ${maskable ? 0.78 : 1};
  const w = s*0.5*k, h = s*0.095*k, r = h/2, cx = s/2, gap = s*0.085*k;
  const bar = (y) => {
    x.fillStyle='#9cab6a';
    x.beginPath(); x.roundRect(cx-w/2, y, w, h, r); x.fill();
  };
  bar(s/2 - gap - h/2 - h/2 + h*0.0);
  bar(s/2 + gap - h/2 + h*0.0);
  return c.toDataURL('image/png');
`;
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["icon-180.png", 180, false], ["icon-maskable-512.png", 512, true]];
for (const [name, size, mask] of jobs) {
  const dataUrl = await page.evaluate(new Function(draw(size, mask)));
  writeFileSync(new URL("./" + name, import.meta.url), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("✔", name);
}
await browser.close();
