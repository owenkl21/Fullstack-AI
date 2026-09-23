import { launch, context, open, signIn, DESK, PHONE } from './lib.mjs';

/*
 * Every route the app has, signed in, on a phone and a desktop: does it render,
 * does it throw, does it scroll sideways, and is anything behind the bottom bar.
 * This is the pass that should have run between the builders and the owner.
 */
const ROUTES = [
   '/', '/catches/me', '/catches/new', '/log', '/map', '/forecast', '/insights',
   '/boards', '/competitions', '/profile', '/sites/me', '/gear/me', '/notifications', '/saved',
];

const b = await launch();
for (const [name, vp] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   const errs = [];
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
   p.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) {
         errs.push('console: ' + m.text().slice(0, 120));
      }
   });
   await signIn(p);

   for (const route of ROUTES) {
      errs.length = 0;
      await open(p, route, 5000);
      const m = await p.evaluate(() => {
         const de = document.documentElement;
         /*
          * Truly covered, not merely low on the screen: ask the document what
          * is painted at the control's own middle. A sticky save bar sitting at
          * the foot of a route where the nav stands down is correct, and only
          * this test can tell the two apart.
          */
         const buried = [...document.querySelectorAll('main button, main a[href], main input')]
            .filter((el) => {
               const r = el.getBoundingClientRect();
               if (r.height < 8 || r.top < 0 || r.bottom > innerHeight) return false;
               const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
               return at !== null && at !== el && !el.contains(at) && !at.contains(el);
            })
            .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 22));
         return {
            h: de.scrollHeight,
            sideways: de.scrollWidth > de.clientWidth + 2,
            h1: document.querySelector('h1')?.textContent?.trim().slice(0, 30) ?? null,
            boundary: /did not load|went wrong|Not found/i.test(document.body.innerText.slice(0, 400)),
            buried: buried.slice(0, 3),
         };
      });
      const bad = m.boundary || m.sideways || errs.length || (name === 'phone' && m.buried.length);
      console.log(
         `${bad ? 'FAIL' : 'ok  '} ${name} ${route.padEnd(16)} h=${String(m.h).padStart(6)}` +
            `${m.sideways ? ' SIDEWAYS' : ''}${m.boundary ? ' BOUNDARY' : ''}` +
            `${m.buried.length ? ' buried:' + JSON.stringify(m.buried) : ''}` +
            `${errs.length ? ' errors:' + JSON.stringify(errs.slice(0, 2)) : ''}`
      );
   }
   await ctx.close();
}
await b.close();
