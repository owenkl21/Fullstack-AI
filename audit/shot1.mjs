import { chromium } from 'playwright';

/* A local HTML file to a PNG: node shot1.mjs <file.html> <out.png> [w] [h] */
const [, , file, out, w, h] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({
   viewport: { width: Number(w || 320), height: Number(h || 200) },
   deviceScaleFactor: 2,
});
await p.goto('file:///' + file.replace(/\\/g, '/'));
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await b.close();
console.log('wrote', out);
