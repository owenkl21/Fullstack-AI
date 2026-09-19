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
   const bad = [];
   page.on('pageerror', (e) => errors.push(String(e)));
   page.on('response', (r) => {
      if (r.status() >= 400 && /\/api\//.test(r.url()))
         bad.push(r.status() + ' ' + r.url().slice(0, 100));
   });
   await signIn(page);
   console.log(`\n================ ${label} ================`);

   for (const route of ['/profile', '/insights']) {
      await open(page, route, 6000);
      /* open every fold so nothing is judged shut */
      for (let i = 0; i < 3; i++) {
         const shut = await page.$$('[aria-expanded="false"]:visible');
         if (!shut.length) break;
         for (const s of shut) {
            try {
               await s.click({ timeout: 2000 });
               await page.waitForTimeout(300);
            } catch {}
         }
      }
      await page.waitForTimeout(1500);
      const text = await page.evaluate(() => document.body.innerText);
      console.log(`\n--- ${route} (${label}) ---`);
      console.log(text.slice(0, 2600));
      /* placeholders and holes */
      const holes = [
         ['NaN', /\bNaN\b/],
         ['undefined', /\bundefined\b/],
         ['null printed', /(^|\s)null(\s|$)/],
         ['Invalid Date', /Invalid Date/i],
         ['lorem', /lorem ipsum/i],
         ['TODO', /\bTODO\b/],
         ['dash placeholder', /(^|\n)\s*[-–—]\s*(\n|$)/],
      ];
      for (const [name, re] of holes)
         pass(`${route} no ${name}`, !re.test(text));
      const dashes = (text.match(/[—–]/g) || []).length;
      pass(`${route} no em or en dash`, dashes === 0, String(dashes));
      /* every link resolves to a real route */
      const links = await page.evaluate(() =>
         [...document.querySelectorAll('a[href]')]
            .filter((a) => !a.closest('header') && !a.closest('nav'))
            .map((a) => ({
               href: a.getAttribute('href'),
               text: (a.textContent || '').trim().slice(0, 28),
            }))
      );
      const dead = links.filter(
         (l) => !l.href || l.href === '#' || /undefined|null/.test(l.href)
      );
      pass(`${route} no dead links`, dead.length === 0, JSON.stringify(dead));
      console.log(
         '   links:',
         links.map((l) => `${l.text || '(image)'} -> ${l.href}`).join(' | ')
      );
      await shot(page, `final-${route.replace(/\W/g, '')}-${label}`, {
         x: 0,
         y: 0,
         ...vp,
      });
   }
   console.log('\n   failed api calls:', bad.length ? bad : 'none');
   console.log('   page errors:', errors.length ? errors : 'none');
   await ctx.close();
}
await browser.close();
