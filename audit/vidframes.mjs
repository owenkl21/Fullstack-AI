import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Frames and facts from a video file, through Chromium (which decodes H.264
 * where the bundled ffmpeg does not): node vidframes.mjs <video> <outdir>
 */
const [, , input, outDir] = process.argv;
const html = path.join(outDir, 'vid.html');
fs.writeFileSync(
   html,
   `<html><body style="margin:0;background:#888"><video id="v" src="file:///${input.replace(/\\/g, '/')}" muted playsinline style="display:block"></video></body></html>`
);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1280 } });
await p.goto('file:///' + html.replace(/\\/g, '/'));
const facts = await p.evaluate(
   () =>
      new Promise((resolve) => {
         const v = document.getElementById('v');
         v.addEventListener('loadedmetadata', () =>
            resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight })
         );
         v.addEventListener('error', () => resolve({ error: v.error?.code }));
      })
);
console.log(JSON.stringify(facts));
if (!facts.error) {
   for (const frac of [0, 0.25, 0.5, 0.75, 0.98]) {
      const t = facts.duration * frac;
      await p.evaluate(
         (t) =>
            new Promise((resolve) => {
               const v = document.getElementById('v');
               v.addEventListener('seeked', () => resolve(), { once: true });
               v.currentTime = t;
            }),
         t
      );
      const el = await p.$('#v');
      await el.screenshot({ path: path.join(outDir, `vid-${Math.round(frac * 100)}.png`) });
   }
   /* Corner colours, to know what ground the clip was made on. */
   const corners = await p.evaluate(() => {
      const v = document.getElementById('v');
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext('2d'); g.drawImage(v, 0, 0);
      const px = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
      return { tl: px(2, 2), tr: px(c.width - 3, 2), bl: px(2, c.height - 3), br: px(c.width - 3, c.height - 3), centre: px(c.width >> 1, c.height >> 1) };
   });
   console.log(JSON.stringify(corners));
}
await b.close();
