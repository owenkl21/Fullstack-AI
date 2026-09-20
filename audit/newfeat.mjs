import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const b = await launch();
const ctx = await context(b, PHONE, { hasTouch: true, reducedMotion: 'reduce' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await signIn(p);

await open(p, '/forecast', 7000);
const rating = await p.evaluate(() => {
   const t = document.body.innerText;
   const m = t.match(/\b(Bad|Good|Great|Exceptional)\b/);
   return { band: m ? m[0] : null, thin: /thin|building|solid/i.test(t), text: t.slice(0, 160).replace(/\n+/g, ' ') };
});
console.log('  forecast rating:', JSON.stringify(rating));
await shot(p, 'feat-forecast');

const sites = await p.request.get('https://fisherfeed.com/api/sites').then((r) => r.json()).catch(() => null);
const id = (sites?.sites ?? sites ?? [])[0]?.id;
if (id) {
   await open(p, `/sites/${id}`, 6000);
   const rev = await p.evaluate(() => {
      const t = document.body.innerText;
      return { hasRating: /rating|rate this|no ratings|out of/i.test(t), snippet: (t.match(/.{0,60}(rating|rate this|no ratings).{0,50}/i) || [''])[0].replace(/\n+/g, ' ') };
   });
   console.log('  spot page:', JSON.stringify(rev));
   await shot(p, 'feat-spot');
}
console.log('  page errors:', errs.length ? errs.slice(0, 2) : 'none');
await b.close();
