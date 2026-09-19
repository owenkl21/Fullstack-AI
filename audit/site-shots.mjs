import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';
/* Every main route, signed out and signed in, phone and desktop, for the taste audit. */
const ROUTES = ['/', '/catches/me', '/map', '/forecast', '/insights', '/boards', '/competitions', '/profile', '/sites/me', '/gear/me', '/notifications', '/saved'];
const b = await launch();
for (const [vp, size] of [['phone', PHONE], ['desk', DESK]]) {
   let ctx = await context(b, size);
   let p = await ctx.newPage();
   await open(p, '/', 4000);
   await shot(p, `site-landing-${vp}`);
   await ctx.close();
   ctx = await context(b, size);
   p = await ctx.newPage();
   const errs = [];
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
   await signIn(p);
   for (const r of ROUTES) {
      await open(p, r, 4000);
      await shot(p, `site-${r === '/' ? 'feed' : r.slice(1).replace(/\//g, '-')}-${vp}`);
   }
   console.log(vp, 'errors:', errs.length ? errs : 'none');
   await ctx.close();
}
await b.close();
console.log('done');
