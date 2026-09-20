import { launch, context, open, PHONE } from './lib.mjs';
const b = await launch();
const ctx = await context(b, PHONE, { hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await open(p, '/', 4000);
for (const tab of ['Catches', 'Map', 'Boards']) {
   await p.locator(`nav[aria-label="App"] button`, { hasText: tab }).first().click();
   await p.waitForTimeout(tab === 'Map' ? 3000 : 900);
   const state = await p.evaluate(() => {
      const on = document.querySelector('[aria-current="page"]');
      const sec = [...document.querySelectorAll('.torn, section')].length;
      return { marked: on?.textContent?.trim(), sec };
   });
   console.log(`  ${tab}: bar marks "${state.marked}"`);
}
await p.screenshot({ path: 'shots/phone-boards.png', clip: { x: 0, y: 260, width: 390, height: 640 } });
console.log('  shot saved');
await b.close();
