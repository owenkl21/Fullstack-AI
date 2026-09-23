import { chromium } from 'playwright';
const file = 'file:///private/tmp/claude-501/-Users-owenkleinhans/5cdb79aa-e9b0-4da5-89d1-31a54b7058ac/scratchpad/landing-rework/Landing%20Page.dc.html';
const browser = await chromium.launch();
for (const [tag, vp] of [['phone', { width: 390, height: 844 }], ['desk', { width: 1440, height: 1000 }]]) {
   const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
   const page = await ctx.newPage();
   await page.goto(file, { waitUntil: 'load', timeout: 60000 });
   await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
      window.scrollTo(0, 0);
      document.querySelectorAll('*').forEach((e) => { const cs = getComputedStyle(e); if (cs.opacity === '0') e.style.opacity = '1'; });
      await new Promise(r => setTimeout(r, 400));
   });
   await page.waitForTimeout(1200);
   const info = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      sections: [...document.querySelectorAll('section')].map((s) => {
         const h = s.querySelector('h1,h2,h3');
         return `${(h ? h.innerText : '(none)').replace(/\n/g, ' ').slice(0, 34)} | ${Math.round(s.getBoundingClientRect().height)}px`;
      }),
   }));
   console.log(`== ${tag} == ${info.height}px\n` + info.sections.map((s) => '  ' + s).join('\n'));
   await page.screenshot({ fullPage: true, path: `shots/design-${tag}.png` });
   await ctx.close();
}
await browser.close();
