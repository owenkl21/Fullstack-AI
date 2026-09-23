import { launch, open, signIn, shot, HOST } from './lib.mjs';

/* Map pins at three times scale, so the mark inside a head can be judged. */
const TAG = process.env.TAG || 'local';
const b = await launch();
const ctx = await b.newContext({
   viewport: { width: 900, height: 700 },
   deviceScaleFactor: 3,
   permissions: ['geolocation'],
   geolocation: { latitude: -34.13, longitude: 18.33 },
});
const p = await ctx.newPage();
await signIn(p);
await open(p, '/map', 9000);
const boxes = await p.evaluate(() => {
   const pins = [...document.querySelectorAll('.leaflet-marker-icon')];
   return pins.slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
   });
});
console.log(JSON.stringify(boxes));
for (const [i, box] of boxes.entries()) {
   if (box.y < 0 || box.y + box.h > 700) continue;
   await shot(p, `${TAG}-pin-${i}`, {
      x: Math.max(0, box.x - 14),
      y: Math.max(0, box.y - 14),
      width: box.w + 28,
      height: box.h + 28,
   });
}
console.log('host', HOST);
await b.close();
