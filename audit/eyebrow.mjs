import { launch, context, open, PHONE } from './lib.mjs';
const b = await launch();
const p = await (await context(b, PHONE, { hasTouch: true, reducedMotion: 'reduce' })).newPage();
await open(p, '/', 3500);
await p.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(() => {
   const out = [];
   for (const id of ['forecast', 'record']) {
      const s = document.getElementById(id);
      const eb = s?.querySelector('.lab-rule');
      const sTop = s.getBoundingClientRect().top + scrollY;
      out.push({
         id,
         sectionTop: Math.round(sTop),
         padTop: getComputedStyle(s).paddingTop,
         eyebrow: eb ? eb.textContent.trim().slice(0, 24) : null,
         eyebrowTop: eb ? Math.round(eb.getBoundingClientRect().top + scrollY) : null,
         clearsHang: eb ? Math.round(eb.getBoundingClientRect().top + scrollY - sTop) : null,
         opacity: eb ? getComputedStyle(eb).opacity : null,
      });
   }
   return out;
}), null, 1));
await b.close();
