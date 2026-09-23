import { launch, context, open, PHONE } from './lib.mjs';
const b = await launch();
const p = await (await context(b, PHONE, { hasTouch: true })).newPage();
await open(p, '/', 4000);
const test = async (tab) => {
   const r = await p.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="App"]');
      const root = nav.parentElement;
      const moved = [];
      const walk = (el, d) => {
         if (d > 7) return;
         const before = el.scrollLeft;
         el.scrollLeft = 200;
         const after = el.scrollLeft;
         el.scrollLeft = before;
         if (after !== before) moved.push({ cls: (el.className || '').toString().slice(0, 48), by: after });
         for (const c of el.children) walk(c, d + 1);
      };
      walk(root, 0);
      return moved;
   });
   const real = r.filter((x) => !/overflow-x-auto/.test(x.cls));
   console.log(`  ${tab.padEnd(8)} ${real.length ? 'SWIPES: ' + JSON.stringify(real) : 'cannot be swiped'}${r.length !== real.length ? '  (season strip scrolls by design)' : ''}`);
};
await test('home');
for (const tab of ['Feed', 'Catches', 'Map', 'Boards']) {
   await p.locator('nav[aria-label="App"] button', { hasText: tab }).first().click();
   await p.waitForTimeout(tab === 'Map' ? 3000 : 900);
   await test(tab);
}
await b.close();
