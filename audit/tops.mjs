import { launch, context, open, PHONE } from './lib.mjs';
const b = await launch();
const p = await (await context(b, PHONE, { hasTouch: true, reducedMotion: 'reduce' })).newPage();
await open(p, '/', 3500);
await p.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(() =>
  [...document.querySelectorAll('section')].filter(s => !s.parentElement.closest('section')).map(s => ({ id: s.id || '-', top: Math.round(s.getBoundingClientRect().top + window.scrollY), h: Math.round(s.getBoundingClientRect().height) }))
)));
await b.close();
