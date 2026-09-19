import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

/* What is sitting on top of "Fewer readings" once the rows are open. */
const b = await launch();
const ctx = await context(b, PHONE, { deviceScaleFactor: 2 });
const p = await ctx.newPage();
await signIn(p);
await open(p, '/forecast', 6000);
await p.getByRole('button', { name: /where i am/i }).click().catch(() => {});
await p.waitForTimeout(7000);
await p.getByRole('button', { name: /more readings/i }).click().catch(() => {});
await p.waitForTimeout(1200);

const m = await p.evaluate(() => {
   const button = [...document.querySelectorAll('button')].find((b) => /readings/i.test(b.textContent ?? ''));
   if (!button) return 'no button';
   const r = button.getBoundingClientRect();
   const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
   const box = (el) => {
      const q = el.getBoundingClientRect();
      return { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height) };
   };
   return {
      button: box(button),
      painted: at ? `${at.tagName}.${String(at.className).slice(0, 60)}` : null,
      paintedBox: at ? box(at) : null,
      paintedText: at ? (at.textContent ?? '').trim().slice(0, 80) : null,
      paintedPosition: at ? getComputedStyle(at).position : null,
      paintedZ: at ? getComputedStyle(at).zIndex : null,
      html: at ? at.outerHTML.slice(0, 200) : null,
   };
});
console.log(JSON.stringify(m, null, 1));
await p.evaluate(() => {
   const b = [...document.querySelectorAll('button')].find((b) => /readings/i.test(b.textContent ?? ''));
   b?.scrollIntoView({ block: 'center' });
});
await p.waitForTimeout(600);
await shot(p, 'readings', { x: 0, y: 0, ...PHONE });
await b.close();
