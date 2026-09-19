import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/*
 * Every plate that ends in a cut edge: the page heads, and the spot page.
 * For each, the water under the crest must be painted in the ground that is
 * really there, and the plate's art must reach the water. Prints the ground
 * colour measured just under the water box beside the colour the water was
 * painted in, and shoots the crest. THEME=dark checks the night theme.
 *   HOST=http://localhost:5173 node plates.mjs
 */
const TAG = process.env.TAG || 'local';
/* The app stores 'day' or 'night' under localStorage 'theme'. */
const THEME = process.env.THEME || 'day';
const ROUTES = (process.env.ROUTES || '/feed,/insights,/forecast,/boards,/competitions,/catches/me,/notifications').split(',');

const b = await launch();
for (const [name, vp] of [['desk', DESK], ['phone', PHONE]]) {
   const ctx = await context(b, vp);
   await ctx.addInitScript((t) => localStorage.setItem('theme', t), THEME);
   const p = await ctx.newPage();
   await signIn(p);
   /* The first of the angler's own spots, for the spot page's plate. */
   await open(p, '/sites/me', 3000);
   const spot = await p.evaluate(() => [...document.querySelectorAll('a[href^="/sites/"]')].map((a) => a.getAttribute('href')).find((h) => /^\/sites\/[^/]+$/.test(h) && !/\/(me|new)$/.test(h)));
   for (const route of [...ROUTES, spot].filter(Boolean)) {
      /* The contour lines draw on over about eight seconds; wait them out. */
      await open(p, route, 9000);
      const m = await p.evaluate(() => {
         const torn = document.querySelector('main .torn-hang');
         if (!torn) return null;
         const head = torn.closest('header');
         const r = (el) => { const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom) }; };
         const t = r(torn);
         const art = head.querySelector('.plate-art');
         /* How far down the sheet the lines really reach, in page pixels. */
         const svg = art?.querySelector('svg');
         let linesTo = null;
         if (svg) {
            const vb = svg.viewBox.baseVal;
            const box = svg.getBoundingClientRect();
            const ys = [...svg.querySelectorAll('path')].map((q) => q.getBBox()).map((bb) => bb.y + bb.height);
            linesTo = ys.length ? Math.round(box.top + (Math.max(...ys) / vb.height) * box.height) : null;
         }
         const water = torn.querySelector('path[data-role="water"]')?.getAttribute('fill');
         /* The ground really under the water box: walk up from the point. */
         let el = document.elementFromPoint(Math.round(innerWidth / 2), t.bottom + 8);
         let ground = null;
         while (el && el !== document.documentElement) {
            const bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { ground = bg; break; }
            el = el.parentElement;
         }
         if (!ground) ground = getComputedStyle(document.body).backgroundColor;
         const rgb = (s) => { const c = document.createElement('i'); c.style.color = s; document.body.appendChild(c); const v = getComputedStyle(c).color; c.remove(); return v; };
         return { head: r(head), torn: t, art: art ? r(art) : null, linesTo, paths: svg?.querySelectorAll('path').length, water: water ? rgb(water) : null, ground, same: water ? rgb(water) === ground : null };
      });
      console.log(THEME, name, route, JSON.stringify(m));
      if (m) {
         const y = Math.max(0, m.torn.top - 60);
         await shot(p, `${TAG}-${THEME}-${name}-crest${route.replace(/\//g, '_')}`, { x: 0, y, width: vp.width, height: Math.min(vp.height - y, m.torn.bottom + 60 - y) });
      }
   }
   await ctx.close();
}
await b.close();
