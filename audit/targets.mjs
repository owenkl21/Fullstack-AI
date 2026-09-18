import { launch, context, open, signIn, PHONE } from './lib.mjs';

/* The 21 pixel links the audit keeps naming: what are they inside, and is the
 * thing a thumb actually lands on big enough. */
const b = await launch();
const ctx = await context(b, PHONE, { deviceScaleFactor: 1 });
const p = await ctx.newPage();
await signIn(p);

for (const route of ['/catches/me', '/sites/me', '/insights']) {
   await open(p, route, 5000);
   const rows = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('main a[href], main button')) {
         const r = el.getBoundingClientRect();
         if (!(r.height > 0 && r.height < 40)) continue;
         const text = (el.textContent ?? '').trim();
         if (!text) continue;
         const chain = [];
         for (let node = el.parentElement, i = 0; node && i < 4; node = node.parentElement, i++) {
            const q = node.getBoundingClientRect();
            chain.push(`${node.tagName.toLowerCase()}.${String(node.className).slice(0, 34)} ${Math.round(q.height)}px`);
         }
         out.push({ text: text.slice(0, 22), h: Math.round(r.height), w: Math.round(r.width), chain });
         if (out.length >= 3) break;
      }
      return out;
   });
   console.log('\n==', route);
   for (const row of rows) {
      console.log(` "${row.text}" ${row.w}x${row.h}`);
      row.chain.forEach((c) => console.log('    ^ ' + c));
   }
}
await b.close();
