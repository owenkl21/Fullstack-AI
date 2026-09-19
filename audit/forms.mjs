import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/*
 * Full-page shots of the two log forms, signed in, on a desktop and a phone.
 * Console errors are printed so a broken page is not mistaken for a design.
 *   node forms.mjs            the live deploy
 *   HOST=http://localhost:5173 node forms.mjs
 */
const TAG = process.env.TAG || 'live';
const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   const errors = [];
   p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
   p.on('pageerror', (e) => errors.push('pageerror ' + String(e).slice(0, 160)));
   await signIn(p);
   for (const [route, file] of [['/log', 'quicklog'], ['/catches/new', 'fullform']]) {
      await open(p, route, 4500);
      const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent?.trim());
      const height = await p.evaluate(() => document.documentElement.scrollHeight);
      console.log(name, route, JSON.stringify({ h1, height, url: p.url() }));
      await shot(p, `${TAG}-${name}-${file}`);
   }
   if (errors.length) console.log(name, 'console errors', JSON.stringify(errors.slice(0, 8)));
   await ctx.close();
}
await b.close();
