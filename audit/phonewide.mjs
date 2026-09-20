import { launch, context, open, PHONE } from './lib.mjs';
const b = await launch();
const p = await (await context(b, PHONE, { hasTouch: true })).newPage();
await open(p, '/', 4000);
const report = async (tab) => {
   const r = await p.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="App"]');
      const root = nav.parentElement;
      const out = [];
      const walk = (el, d) => {
         if (d > 6) return;
         const sw = el.scrollWidth, cw = el.clientWidth;
         if (cw && sw > cw + 1) out.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 54), sw, cw });
         for (const c of el.children) walk(c, d + 1);
      };
      walk(root, 0);
      return out.slice(0, 5);
   });
   console.log(`  ${tab.padEnd(8)} ${r.length ? JSON.stringify(r) : 'no horizontal overflow'}`);
};
await report('home');
for (const tab of ['Feed', 'Catches', 'Map', 'Boards']) {
   await p.locator('nav[aria-label="App"] button', { hasText: tab }).first().click();
   await p.waitForTimeout(tab === 'Map' ? 3000 : 900);
   await report(tab);
}
await b.close();
