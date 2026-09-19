import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';
/* The name on screen, the mark beside it, and the tab title. */
const browser = await launch();
const pass = (n, ok, note = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);
for (const [tag, vp] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(browser, vp, { hasTouch: tag === 'phone' });
   const page = await ctx.newPage();
   const misses = [];
   page.on('response', (r) => { if (r.status() >= 400 && /brand\//.test(r.url())) misses.push(`${r.status()} ${r.url().slice(-30)}`); });
   await signIn(page);
   await open(page, '/feed', 4000);
   const seen = await page.evaluate(() => {
      const link = document.querySelector('header a[aria-label]');
      const img = document.querySelector('header img');
      const masked = [...document.querySelectorAll('*')].some((e) => /fisherfeed-mark/.test(getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || ''));
      return {
         title: document.title,
         aria: link?.getAttribute('aria-label'),
         word: link?.textContent?.trim(),
         markSrc: img?.currentSrc?.split('/').pop(),
         markLoaded: img ? img.naturalWidth > 0 : false,
         maskUsesNewName: masked,
         oldNameOnPage: /Fishtagram/i.test(document.body.innerText),
      };
   });
   console.log(`== ${tag} ==`, JSON.stringify(seen));
   pass(`${tag} the wordmark reads the new name`, seen.word === 'Fisherfeed' && seen.aria === 'Fisherfeed, home');
   pass(`${tag} the mark loads`, seen.markLoaded && seen.markSrc === 'fisherfeed-mark.png');
   pass(`${tag} the old name is nowhere on the page`, !seen.oldNameOnPage);
   pass(`${tag} no brand asset 404s`, misses.length === 0, misses.join(', '));
   await shot(page, `brand-${tag}`);
   await ctx.close();
}
await browser.close();
