/*
 * Focus-zoom floor check. Walks the routes with a COARSE pointer (hasTouch), so
 * the @media (pointer: coarse) floor in index.css is actually in play, and
 * prints every control's computed size next to its own class list and its
 * parent's size. Two things matter in the output:
 *   UNDER16   a control that would still zoom iOS on focus
 *   INHERITS  a control over 16px that states no size of its own, i.e. one the
 *             blanket floor could shrink if it were written without exclusions
 */
import { launch, context, open, signIn, PHONE } from './lib.mjs';

const PROBE = () => {
   const out = [];
   const sel =
      'input, select, textarea, [role="combobox"], [contenteditable]:not([contenteditable="false"])';
   for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const cls =
         (el.className && el.className.baseVal !== undefined
            ? el.className.baseVal
            : el.className) || '';
      out.push({
         tag: el.tagName.toLowerCase(),
         type: el.getAttribute('type') || el.tagName.toLowerCase(),
         id: el.id || '',
         ph: el.getAttribute('placeholder') || '',
         aria: el.getAttribute('aria-label') || '',
         cls: String(cls),
         fs: parseFloat(cs.fontSize),
         pfs: el.parentElement
            ? parseFloat(getComputedStyle(el.parentElement).fontSize)
            : 0,
         ta: cs.touchAction,
         vis:
            r.width > 0 &&
            r.height > 0 &&
            cs.visibility !== 'hidden' &&
            cs.display !== 'none',
      });
   }
   return { coarse: matchMedia('(pointer: coarse)').matches, out };
};

const SIZE = /text-\[[0-9.]+(px|rem|em)\]|text-(xs|sm|base|lg|[0-9]?xl)\b/;

const routes = process.argv.slice(2).length
   ? process.argv.slice(2)
   : [
        '/',
        '/map',
        '/log',
        '/forecast',
        '/insights',
        '/profile',
        '/account',
        '/feed',
        '/saved',
        '/sites/new',
        '/sites/me',
        '/gear/new',
        '/catches/me',
        '/competitions',
        '/competitions/new',
        '/boards',
        '/notifications',
        '/sign-in',
        '/sign-up',
     ];

const b = await launch();
const ctx = await context(b, PHONE, { hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await signIn(page);

const under = [];
const inherits = [];
let coarseSeen = null;
for (const r of routes) {
   try {
      await open(page, r, 3000);
   } catch (e) {
      console.log(`\n## ${r} (LOAD FAILED ${String(e).slice(0, 70)})`);
      continue;
   }
   const { coarse, out } = await page.evaluate(PROBE);
   coarseSeen = coarse;
   console.log(`\n## ${r}  (${out.length} controls, coarse=${coarse})`);
   for (const c of out) {
      if (!c.vis) continue;
      const own = SIZE.test(c.cls);
      const flags = [];
      if (c.fs < 16) flags.push('UNDER16');
      if (c.fs > 16 && !own) flags.push('INHERITS');
      if (c.fs < 16) under.push({ route: r, ...c });
      if (c.fs > 16 && !own) inherits.push({ route: r, ...c });
      console.log(
         `   ${c.tag}[${c.type}] fs=${c.fs} parent=${c.pfs} ta=${c.ta} own=${own} id="${c.id}" ph="${c.ph}" aria="${c.aria}" ${flags.join(' ')}`
      );
      if (flags.length) console.log(`      class: ${c.cls.slice(0, 180)}`);
   }
}

console.log(`\n\n==== coarse pointer matched: ${coarseSeen} ====`);
console.log(`==== VISIBLE CONTROLS UNDER 16px: ${under.length} ====`);
for (const c of under)
   console.log(
      `${c.route}  ${c.tag}[${c.type}] ${c.fs}px  id="${c.id}" ph="${c.ph}" aria="${c.aria}"`
   );
console.log(
   `==== OVER 16px WITH NO SIZE CLASS OF THEIR OWN: ${inherits.length} ====`
);
for (const c of inherits)
   console.log(
      `${c.route}  ${c.tag}[${c.type}] ${c.fs}px (parent ${c.pfs}px) ph="${c.ph}" class="${c.cls.slice(0, 120)}"`
   );
await b.close();
