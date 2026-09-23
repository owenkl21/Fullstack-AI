import { chromium } from 'playwright';
const dir = '/private/tmp/claude-501/-Users-owenkleinhans/5cdb79aa-e9b0-4da5-89d1-31a54b7058ac/scratchpad/mail';
const b = await chromium.launch();
for (const [tag, vp, scheme] of [['desk', { width: 700, height: 900 }, 'light'], ['dark', { width: 700, height: 900 }, 'dark']]) {
   const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 2 });
   const p = await ctx.newPage();
   await p.goto(`file://${dir}/verify.html`, { waitUntil: 'load' });
   await p.waitForTimeout(1200);
   const img = await p.evaluate(() => {
      const i = document.querySelector('img[src*="fisherfeed-mark"]');
      return i ? { loaded: i.naturalWidth > 0, w: i.naturalWidth, box: Math.round(i.getBoundingClientRect().width) } : null;
   });
   console.log(`  ${tag}: logo ${JSON.stringify(img)}`);
   await p.screenshot({ path: `shots/mail-${tag}.png`, clip: { x: 0, y: 0, width: 700, height: 420 } });
   await ctx.close();
}
await b.close();
