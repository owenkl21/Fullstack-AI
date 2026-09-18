import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

/*
 * The Fishtagram mark from the Canva export (a 1500 x 1500 SVG wrapping three
 * raster layers on a black square). Renders it flat, then:
 *   - the header mark: black made transparent, trimmed to the fish, so it sits
 *     on the always-black header whatever exact black the export used;
 *   - the favicons: the black square kept, at 64 and 180.
 *   node logo.mjs <in.svg> <client/public dir>
 */
const [, , input, publicDir] = process.argv;
const svg = fs.readFileSync(input, 'utf8');
const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const b = await chromium.launch();
const render = async (size) => {
   const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
   await p.setContent(
      `<html><body style="margin:0;background:transparent"><img src="${data}" style="width:${size}px;height:${size}px;display:block"></body></html>`
   );
   await p.waitForTimeout(600);
   const buf = await p.screenshot({ omitBackground: true });
   await p.close();
   return buf;
};

/* Favicons keep the square. */
fs.writeFileSync(path.join(publicDir, 'favicon.png'), await render(64));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), await render(180));

/* The mark: knock out the black, trim, and write at two sizes. */
const big = PNG.sync.read(await render(1024));
const BLACK = 34;
let minX = big.width, minY = big.height, maxX = 0, maxY = 0;
for (let y = 0; y < big.height; y++) {
   for (let x = 0; x < big.width; x++) {
      const i = (big.width * y + x) * 4;
      const [r, g, bl] = [big.data[i], big.data[i + 1], big.data[i + 2]];
      if (r < BLACK && g < BLACK && bl < BLACK) {
         big.data[i + 3] = 0;
      } else if (big.data[i + 3] > 0) {
         if (x < minX) minX = x;
         if (x > maxX) maxX = x;
         if (y < minY) minY = y;
         if (y > maxY) maxY = y;
      }
   }
}
const pad = 8;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(big.width - 1, maxX + pad); maxY = Math.min(big.height - 1, maxY + pad);
const w = maxX - minX + 1, h = maxY - minY + 1;
const cut = new PNG({ width: w, height: h });
PNG.bitblt(big, cut, minX, minY, w, h, 0, 0);
fs.mkdirSync(path.join(publicDir, 'brand'), { recursive: true });
const out = path.join(publicDir, 'brand', 'fishtagram-mark.png');

/*
 * The header shows the mark about 32px tall, so a 1024-wide cut is eight
 * times what a retina screen can use. Let the browser resample it down to
 * 320 wide, which keeps the file small and the fin crisp at 2x.
 */
const trimmed = `data:image/png;base64,${PNG.sync.write(cut).toString('base64')}`;
const targetW = 320;
const targetH = Math.round((h / w) * targetW);
const p = await b.newPage({ viewport: { width: targetW, height: targetH }, deviceScaleFactor: 1 });
await p.setContent(
   `<html><body style="margin:0;background:transparent"><img src="${trimmed}" style="width:${targetW}px;height:${targetH}px;display:block"></body></html>`
);
await p.waitForTimeout(300);
fs.writeFileSync(out, await p.screenshot({ omitBackground: true }));
console.log(JSON.stringify({ mark: out, width: targetW, height: targetH, ratio: +(w / h).toFixed(3) }));
await b.close();
