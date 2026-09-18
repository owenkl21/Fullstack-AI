import { launch, shot, HOST, passChallenge } from './lib.mjs';

/*
 * The waterline up close, at 2x, on a public page head: the crest, the
 * troughs and whatever sits under them. Three frames a second apart, because
 * the water moves and a fault may only show in a deep trough.
 */
const TAG = process.env.TAG || 'live';
const b = await launch();
for (const [name, vp] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
   const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
   if (process.env.THEME) await ctx.addInitScript((t) => localStorage.setItem('theme', t), process.env.THEME);
   const p = await ctx.newPage();
   await p.goto(HOST + '/forecast', { waitUntil: 'load', timeout: 60000 });
   await passChallenge(p);
   await p.waitForTimeout(9000);
   const torn = await p.evaluate(() => {
      const t = document.querySelector('main .torn-hang');
      const r = t.getBoundingClientRect();
      const art = document.querySelector('main .plate-art')?.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, artBottom: art?.bottom ?? null };
   });
   console.log(name, JSON.stringify(torn));
   for (let i = 0; i < 3; i++) {
      await shot(p, `${TAG}-${name}-wave-${i}`, { x: 0, y: Math.max(0, torn.top - 30), width: Math.min(vp.width, 900), height: torn.bottom - torn.top + 90 });
      await p.waitForTimeout(1100);
   }
   await ctx.close();
}
await b.close();
