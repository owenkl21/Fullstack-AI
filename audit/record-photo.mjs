import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';
/* A record whose card and thumb copies are missing must still show its photograph, fast. */
const id = process.argv[2] || 'cmu8spk84005t0aql00eiyxyc';
const browser = await launch();
const pass = (n, ok, note = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);
for (const [tag, vp] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(browser, vp, { hasTouch: tag === 'phone' });
   const page = await ctx.newPage();
   const misses = [];
   page.on('response', (r) => { if (r.status() === 404 && /\.(card|thumb)\.jpg/.test(r.url())) misses.push(r.url().replace(/\?.*$/, '').slice(-14)); });
   if (process.env.BREAK_COPIES) {
      /* Pretend the copies are missing, which is how every phone-logged
         catch stood before the strip made them. */
      await page.route(/\.(card|thumb)\.jpg/, (route) => route.fulfill({ status: 404, body: 'gone' }));
   }
   await signIn(page);
   await open(page, `/catches/${id}`, 2500);
   const read = () =>
      page.evaluate(() => {
         const img = [...document.querySelectorAll('img')].find((i) => /photo \d+ of \d+/.test(i.alt));
         if (!img) return { present: false, none: /No photo of this catch/.test(document.body.innerText) };
         const r = img.getBoundingClientRect();
         return {
            present: true,
            natural: `${img.naturalWidth}x${img.naturalHeight}`,
            box: `${Math.round(r.width)}x${Math.round(r.height)}`,
            opacity: getComputedStyle(img).opacity,
            src: img.currentSrc.replace(/\?.*$/, '').slice(-14),
            none: /No photo of this catch/.test(document.body.innerText),
         };
      });
   const at2 = await read();
   await page.waitForTimeout(2500);
   const at5 = await read();
   console.log(`== ${tag} ==  at 2.5s ${JSON.stringify(at2)}\n              at 5s   ${JSON.stringify(at5)}\n              404s: ${misses.join(', ') || 'none'}`);
   pass(`${tag} the photograph is drawn`, at5.present && at5.opacity === '1' && at5.natural !== '0x0' && !at5.none);
   pass(`${tag} it is on its way within 2.5 s`, at2.present && Number(at2.opacity) > 0.5, `opacity ${at2.opacity}`);
   await shot(page, `record-photo-${tag}`);
   await ctx.close();
}
await browser.close();
