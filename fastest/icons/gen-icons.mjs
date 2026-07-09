// Genera los íconos PNG de Fastest rasterizando un canvas en Chromium.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const draw = (size, maskable) => `
  const c = document.createElement('canvas'); c.width=${size}; c.height=${size};
  const x = c.getContext('2d'); const s=${size};
  const g = x.createLinearGradient(0,0,s,s);
  g.addColorStop(0,'#0a1030'); g.addColorStop(1,'#05060f');
  x.fillStyle=g;
  ${maskable ? `x.fillRect(0,0,s,s);` : `const r=s*0.22; x.beginPath(); x.roundRect?x.roundRect(0,0,s,s,r):x.rect(0,0,s,s); x.fill();`}
  // rayo neón
  const cx=s/2, cy=s/2, k=s*(${maskable ? 0.017 : 0.02});
  x.translate(cx,cy); x.scale(k,k); x.translate(-12,-16);
  const grad = x.createLinearGradient(0,0,24,32);
  grad.addColorStop(0,'#16f2c4'); grad.addColorStop(1,'#2d7bff');
  x.fillStyle=grad; x.shadowColor='rgba(22,242,196,.9)'; x.shadowBlur=6;
  x.beginPath();
  x.moveTo(14,0); x.lineTo(2,18); x.lineTo(11,18); x.lineTo(8,32); x.lineTo(22,12); x.lineTo(13,12); x.closePath();
  x.fill();
  return c.toDataURL('image/png');
`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
const jobs = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-180.png", 180, false],
  ["icon-maskable-512.png", 512, true],
];
for (const [name, size, mask] of jobs) {
  const dataUrl = await page.evaluate(new Function(draw(size, mask)));
  const b64 = dataUrl.split(",")[1];
  writeFileSync(new URL("./" + name, import.meta.url), Buffer.from(b64, "base64"));
  console.log("✔", name);
}
await browser.close();
