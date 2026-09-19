import { chromium } from 'playwright';
/* Render an SVG file to a transparent PNG at a given size: node svgshot.mjs in.svg out.png 512 */
const [, , input, output, sizeArg] = process.argv;
const size = Number(sizeArg || 512);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
const svg = (await import('fs')).readFileSync(input, 'utf8');
await p.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${size}px;height:${size}px;display:block"></body></html>`);
await p.waitForTimeout(800);
await p.screenshot({ path: output, omitBackground: true });
await b.close();
console.log('wrote', output);
