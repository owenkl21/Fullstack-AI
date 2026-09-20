import { launch, context, open, PHONE } from './lib.mjs';
const b = await launch();
const p = await (await context(b, PHONE, { hasTouch: true })).newPage();
await open(p, '/', 4000);
const test = async (tab) => {
   const r = await p.evaluate(() => {
      const root = document.querySelector('nav[aria-label="App"]').parentElement;
      const out = [];
      const walk = (el, d) => {
         if (d > 7) return;
         const ox = getComputedStyle(el).overflowX;
         if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1)
            out.push({ cls: (el.className || '').toString().slice(0, 44), over: el.scrollWidth - el.clientWidth });
         for (const c of el.children) walk(c, d + 1);
      };
      walk(root, 0);
      return out;
   });
   const unintended = r.filter((x) => !/overflow-x-auto|leaflet/.test(x.cls));
   console.log(`  ${tab.padEnd(8)} ${unintended.length ? 'SWIPEABLE: ' + JSON.stringify(unintended) : 'nothing a finger can swipe'}`);
};
await test('home');
for (const tab of ['Feed', 'Catches', 'Map', 'Boards']) {
   await p.locator('nav[aria-label="App"] button', { hasText: tab }).first().click();
   await p.waitForTimeout(tab === 'Map' ? 3000 : 900);
   await test(tab);
}
await b.close();
