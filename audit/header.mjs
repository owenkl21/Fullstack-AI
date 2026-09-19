import { launch, context, open, shot, DESK, PHONE } from './lib.mjs';

/* The header with the wordmark, signed out, on both widths, plus the tab title. */
const TAG = process.env.TAG || 'local';
const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   await open(p, '/', 2500);
   const m = await p.evaluate(() => {
      const img = document.querySelector('header img[src*="fishtagram"]');
      const r = img?.getBoundingClientRect();
      return { title: document.title, mark: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null, icon: document.querySelector('link[rel="icon"]')?.getAttribute('href') };
   });
   console.log(name, JSON.stringify(m));
   await shot(p, `${TAG}-${name}-header`, { x: 0, y: 0, width: vp.width, height: 120 });
   await ctx.close();
}
await b.close();
