import { launch, context, open, PHONE, DESK } from './lib.mjs';
const browser = await launch();
for (const [tag, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(browser, vp, { hasTouch: tag === 'phone', reducedMotion: 'reduce' });
   const page = await ctx.newPage();
   await open(page, '/', 4000);
   /* walk the page so every scroll-reveal has fired, then come back */
   await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
      document.querySelectorAll('.rv').forEach((e) => { e.style.opacity = '1'; e.style.transform = 'none'; });
      await new Promise((r) => setTimeout(r, 400));
   });
   await page.waitForTimeout(1200);
   const info = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      screens: +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
      words: (document.body.innerText || '').trim().split(/\s+/).length,
      headings: [...document.querySelectorAll('h1,h2')].map((h) => h.innerText.replace(/\n/g, ' ').slice(0, 50)),
      eyebrows: [...document.querySelectorAll('.lab')].map((e) => e.innerText.slice(0, 26)),
      ctas: [...document.querySelectorAll('a[href*="sign"],button')].map((b) => b.innerText.trim().slice(0, 24)).filter(Boolean),
      images: document.querySelectorAll('img').length,
   }));
   console.log(`== ${tag} ==`, JSON.stringify(info, null, 1));
   await page.screenshot({ fullPage: true, path: `shots/landing-now-${tag}.png` });
   await ctx.close();
}
await browser.close();
