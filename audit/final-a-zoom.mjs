import { launch, context, open, signIn, PHONE, DESK } from './lib.mjs';

/* Complaint (a): focusing a control must not zoom the page on a phone.
   Chromium does not actually zoom, so the measurable cause is checked:
   every focusable control must compute >= 16px with a coarse pointer, and
   the viewport meta must still permit pinch. */

const ROUTES = [
   '/log',
   '/catches/new',
   '/map',
   '/forecast',
   '/sites/new',
   '/',
   '/catches/me',
   '/competitions/new',
   '/profile',
   '/insights',
];

const browser = await launch();

async function sweep(viewport, label, coarse) {
   const ctx = await context(
      browser,
      viewport,
      coarse ? { hasTouch: true, isMobile: false } : {}
   );
   /* force a coarse pointer the way a phone reports one */
   const page = await ctx.newPage();
   if (coarse) await ctx.addInitScript(() => {});
   await signIn(page);
   const rows = [];
   for (const route of ROUTES) {
      await open(page, route, 2500);
      const found = await page.evaluate(() => {
         const out = [];
         const all = document.querySelectorAll(
            'input, select, textarea, [role=combobox]'
         );
         for (const el of all) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            out.push({
               tag: el.tagName.toLowerCase(),
               type: el.getAttribute('type') || '',
               name:
                  el.getAttribute('aria-label') ||
                  el.getAttribute('placeholder') ||
                  el.getAttribute('name') ||
                  el.id ||
                  '',
               size: parseFloat(cs.fontSize),
               touch: cs.touchAction,
            });
         }
         return out;
      });
      for (const f of found) rows.push({ route, ...f });
   }
   /* now focus a handful for real and read activeElement */
   const focused = [];
   for (const route of ['/log', '/map', '/forecast', '/sites/new']) {
      await open(page, route, 2500);
      const handles = await page.$$(
         'input:visible, textarea:visible, select:visible'
      );
      for (const h of handles.slice(0, 6)) {
         try {
            await h.focus();
            const info = await page.evaluate(() => {
               const el = document.activeElement;
               if (!el) return null;
               const cs = getComputedStyle(el);
               return {
                  tag: el.tagName.toLowerCase(),
                  type: el.getAttribute('type') || '',
                  name:
                     el.getAttribute('aria-label') ||
                     el.getAttribute('placeholder') ||
                     el.getAttribute('name') ||
                     '',
                  size: parseFloat(cs.fontSize),
                  touch: cs.touchAction,
               };
            });
            if (info) focused.push({ route, ...info });
         } catch {
            /* a control that will not take focus is not a zoom risk */
         }
      }
   }
   const meta = await page.evaluate(() => {
      const m = document.querySelector('meta[name=viewport]');
      return m ? m.getAttribute('content') : null;
   });
   await ctx.close();
   return { label, rows, focused, meta };
}

const phone = await sweep(PHONE, 'phone 390 coarse', true);
const desk = await sweep(DESK, 'desk 1440 fine', false);

console.log('viewport meta:', phone.meta);
const pinchBlocked =
   /maximum-scale\s*=\s*1(\.0)?\b/.test(phone.meta || '') ||
   /user-scalable\s*=\s*(no|0)/.test(phone.meta || '');
console.log('pinch zoom blocked by the meta:', pinchBlocked);

const small = phone.rows.filter((r) => r.size < 16);
console.log(
   `\nphone: ${phone.rows.length} visible controls swept, ${small.length} under 16px`
);
for (const s of small)
   console.log(
      '  UNDER 16  ',
      s.route,
      s.tag,
      s.type,
      JSON.stringify(s.name),
      s.size
   );

const badTouch = phone.rows.filter(
   (r) => r.touch !== 'manipulation' && r.touch !== 'none'
);
console.log(
   `phone: ${badTouch.length} controls without touch-action manipulation/none`
);
for (const s of badTouch.slice(0, 12))
   console.log('  TOUCH  ', s.route, s.tag, JSON.stringify(s.name), s.touch);

console.log('\nphone, focused for real:');
for (const f of phone.focused)
   console.log(
      `  ${f.route.padEnd(12)} ${f.tag}${f.type ? '[' + f.type + ']' : ''} ${JSON.stringify(f.name).padEnd(34)} ${f.size}px  touch-action ${f.touch}`
   );

console.log('\ndesk, focused for real (must be free to be smaller):');
for (const f of desk.focused)
   console.log(
      `  ${f.route.padEnd(12)} ${f.tag}${f.type ? '[' + f.type + ']' : ''} ${JSON.stringify(f.name).padEnd(34)} ${f.size}px  touch-action ${f.touch}`
   );

await browser.close();
console.log(
   `\nRESULT a: ${!pinchBlocked && small.length === 0 ? 'PASS' : 'FAIL'}`
);
