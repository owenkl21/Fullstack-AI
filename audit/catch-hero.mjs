import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';
const id = process.argv[2];
const browser = await launch();
for (const [tag, vp] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(browser, vp, { hasTouch: tag === 'phone' });
   const page = await ctx.newPage();
   await signIn(page);
   await open(page, `/catches/${id}`, 7000);
   const info = await page.evaluate(() => {
      const out = [];
      for (const i of document.querySelectorAll('img')) {
         if (!/r2\.cloudflarestorage|fisherfeed-mark/.test(i.currentSrc)) continue;
         const r = i.getBoundingClientRect();
         const cs = getComputedStyle(i);
         const chain = [];
         let el = i.parentElement;
         for (let d = 0; d < 4 && el; d++) {
            const c = getComputedStyle(el);
            chain.push(`${el.tagName.toLowerCase()}[${(el.className || '').toString().slice(0, 40)}] op=${c.opacity} vis=${c.visibility} disp=${c.display}`);
            el = el.parentElement;
         }
         out.push({
            src: i.currentSrc.replace(/\?.*$/, '').slice(-45),
            alt: i.alt,
            natural: `${i.naturalWidth}x${i.naturalHeight}`,
            complete: i.complete,
            box: `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`,
            opacity: cs.opacity, visibility: cs.visibility, display: cs.display, objectFit: cs.objectFit, cls: (i.className || '').toString().slice(0, 80),
            chain,
         });
      }
      const hero = document.querySelector('header, [data-hero], article > div, article > section');
      return { out, heroText: (document.querySelector('article')?.innerText || '').slice(0, 120) };
   });
   console.log(`== ${tag} ==`);
   console.log(JSON.stringify(info, null, 1));
   await shot(page, `catch-hero-${tag}`);
   await ctx.close();
}
await browser.close();
