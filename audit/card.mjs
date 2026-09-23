import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

/* One feed card, at real scale, with its action row measured. */
const TAG = process.env.TAG || 'live';
const b = await launch();
const ctx = await context(b, PHONE, { deviceScaleFactor: 2 });
const p = await ctx.newPage();
await signIn(p);
await open(p, '/', 7000);

const m = await p.evaluate(() => {
   const card = [...document.querySelectorAll('article')].find((a) =>
      a.getBoundingClientRect().height > 200
   );
   if (!card) return null;
   card.scrollIntoView({ block: 'center' });
   const r = card.getBoundingClientRect();
   const bits = [...card.querySelectorAll('button, a, span, p')]
      .filter((el) => (el.textContent ?? '').trim().length > 0)
      .slice(-8)
      .map((el) => {
         const q = el.getBoundingClientRect();
         const cs = getComputedStyle(el);
         return {
            text: (el.textContent ?? '').trim().slice(0, 24),
            y: Math.round(q.y),
            h: Math.round(q.height),
            bottom: Math.round(q.bottom),
            font: cs.fontSize,
            line: cs.lineHeight,
            overflow: cs.overflow,
         };
      });
   return { card: { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom) }, bits };
});
console.log(JSON.stringify(m, null, 1));
if (m) {
   await p.waitForTimeout(600);
   const r = await p.evaluate(() => {
      const card = [...document.querySelectorAll('article')].find((a) => a.getBoundingClientRect().height > 200);
      const q = card.getBoundingClientRect();
      return {
         x: Math.max(0, q.x - 4),
         y: Math.max(0, q.y - 4),
         width: Math.min(390, q.width + 8),
         height: Math.min(844 - Math.max(0, q.y - 4), q.height + 40),
      };
   });
   await shot(p, `${TAG}-card`, r);
}
await b.close();
