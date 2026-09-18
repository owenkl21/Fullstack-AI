import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/* The map's pins, close up: the glyph in a spot pin and in a cluster. */
const TAG = process.env.TAG || 'local';
const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   await signIn(p);
   await open(p, '/map', 8000);
   const box = await p.evaluate(() => {
      const pins = [...document.querySelectorAll('.leaflet-marker-icon')];
      if (!pins.length) return null;
      const r = pins[0].getBoundingClientRect();
      return { count: pins.length, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
   });
   console.log(name, JSON.stringify(box));
   if (box) {
      const pad = 90;
      await shot(p, `${TAG}-${name}-pins`, {
         x: Math.max(0, box.x - pad),
         y: Math.max(0, box.y - pad),
         width: Math.min(vp.width, pad * 2 + box.w),
         height: Math.min(vp.height, pad * 2 + box.h),
      });
   }
   await ctx.close();
}
await b.close();
