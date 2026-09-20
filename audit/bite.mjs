import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const b = await launch();
const p = await (await context(b, PHONE, { hasTouch: true, reducedMotion: 'reduce' })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await signIn(p);
await open(p, '/forecast', 9000);
const r = await p.evaluate(() => {
   const t = document.body.innerText;
   const m = t.match(/\b(bad|good|great|exceptional)\b/gi);
   const conf = t.match(/worth going|best hours|read from/i);
   return { bands: m ? [...new Set(m)] : [], confidence: conf ? conf[0] : null, first: t.slice(0, 220).replace(/\n+/g, ' | ') };
});
console.log('  bands on page:', JSON.stringify(r.bands), '| confidence:', r.confidence);
console.log('  page top:', r.first);
console.log('  errors:', errs.length ? errs.slice(0,1) : 'none');
await shot(p, 'bite-phone');
await b.close();
