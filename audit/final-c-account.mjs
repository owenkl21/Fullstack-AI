import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';

const browser = await launch();
const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);

for (const [label, vp] of [
   ['phone', PHONE],
   ['desk', DESK],
]) {
   const ctx = await context(
      browser,
      vp,
      label === 'phone' ? { hasTouch: true } : {}
   );
   const page = await ctx.newPage();
   const errors = [];
   page.on('pageerror', (e) => errors.push(String(e)));
   await signIn(page);
   await open(page, '/', 3000);

   /* the avatar in the header */
   const trigger = page.locator('button[aria-label="Your account"]').first();
   console.log('   trigger found:', await trigger.count());
   await trigger.click();
   await page.waitForTimeout(1200);
   console.log(
      '   dialogs:',
      await page.evaluate(() =>
         [...document.querySelectorAll('[role=dialog]')].map(
            (d) => d.getAttribute('data-state') + ' ' + d.className.slice(0, 40)
         )
      )
   );

   const panel = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog][data-state=open]');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      const cs = getComputedStyle(d);
      const rows = [...d.querySelectorAll('a, button')]
         .map((el) => (el.textContent || '').trim())
         .filter(Boolean);
      return {
         top: Math.round(r.top),
         bottom: Math.round(r.bottom),
         left: Math.round(r.left),
         right: Math.round(r.right),
         w: Math.round(r.width),
         h: Math.round(r.height),
         vh: innerHeight,
         vw: innerWidth,
         pos: cs.position,
         bg: cs.backgroundColor,
         rows,
         overlay: !!document.querySelector(
            '[data-radix-dialog-overlay], .sheet-overlay'
         ),
      };
   });
   console.log(`\n--- ${label} ---`);
   if (!panel) {
      pass(`${label} the account control opens a panel`, false);
      await ctx.close();
      continue;
   }
   pass(
      `${label} the account control opens a full height side panel`,
      panel.top <= 1 &&
         panel.bottom >= panel.vh - 1 &&
         panel.right >= panel.vw - 1,
      `${panel.w}x${panel.h} at ${panel.left},${panel.top} in a ${panel.vw}x${panel.vh} window`
   );
   pass(
      `${label} it is a panel, not a small dropdown`,
      panel.h >= panel.vh * 0.95 && panel.w >= 280,
      `${panel.w}x${panel.h}`
   );
   pass(`${label} it has a scrim`, panel.overlay);
   console.log('   rows:', panel.rows.join(' | '));

   /* focus stays inside */
   const trap = await page.evaluate(async () => {
      const d = document.querySelector('[role=dialog][data-state=open]');
      return d ? d.contains(document.activeElement) : false;
   });
   pass(`${label} focus lands inside the panel`, trap);

   await shot(page, `final-account-${label}`, { x: 0, y: 0, ...vp });
   await page.keyboard.press('Escape');
   await page.waitForTimeout(600);
   const shut = await page.evaluate(
      () => !document.querySelector('[role=dialog][data-state=open]')
   );
   pass(`${label} escape closes it`, shut);
   console.log('   page errors:', errors.length ? errors : 'none');
   await ctx.close();
}
await browser.close();
