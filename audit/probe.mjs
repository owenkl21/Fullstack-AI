import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/*
 * One pass over the pages the owner named, measuring rather than guessing:
 * what is clipped, what overlaps, how many photographs a page really shows,
 * how big they are on the wire against the box they are drawn in, and what
 * the page weighs.
 */
const TAG = process.env.TAG || 'live';

const weigh = (p) => {
   const seen = [];
   p.on('response', async (r) => {
      const url = r.url();
      const type = r.request().resourceType();
      if (!['image', 'script', 'stylesheet', 'font', 'media'].includes(type)) return;
      const len = Number(r.headers()['content-length'] ?? 0);
      seen.push({ type, url: url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('/') + 60), bytes: len });
   });
   return seen;
};

const b = await launch();
for (const [name, vp] of [['phone', PHONE], ['desk', DESK]]) {
   const ctx = await context(b, vp);
   const p = await ctx.newPage();
   const res = weigh(p);
   await signIn(p);

   /* ---- the feed: clipped cards, and the weight of its photographs ---- */
   const t0 = Date.now();
   await open(p, '/', 6000);
   const feed = await p.evaluate(() => {
      const clipped = [];
      for (const el of document.querySelectorAll('article *')) {
         const cs = getComputedStyle(el);
         const r = el.getBoundingClientRect();
         if (r.height < 2) continue;
         /* A box whose content is taller than itself and cannot scroll. */
         if (el.scrollHeight > Math.ceil(r.height) + 1 && cs.overflow !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') {
            clipped.push({ tag: el.tagName.toLowerCase(), cls: (el.className?.toString?.() ?? '').slice(0, 54), text: (el.textContent ?? '').trim().slice(0, 30), h: Math.round(r.height), content: el.scrollHeight, line: cs.lineHeight, font: cs.fontSize });
         }
      }
      const imgs = [...document.querySelectorAll('article img')].map((i) => ({
         box: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
         natural: `${i.naturalWidth}x${i.naturalHeight}`,
         loading: i.loading,
         decoding: i.decoding,
         sizes: i.sizes || null,
         srcset: i.srcset ? 'yes' : 'no',
         src: i.currentSrc.slice(i.currentSrc.lastIndexOf('/') + 1, i.currentSrc.lastIndexOf('/') + 40),
      }));
      return { cards: document.querySelectorAll('article').length, clipped: clipped.slice(0, 8), imgs: imgs.slice(0, 8) };
   });
   console.log(name, 'FEED', JSON.stringify(feed, null, 1));
   await shot(p, `${TAG}-${name}-feed`);

   /* ---- the profile: how many photographs, and are any hidden ---- */
   await open(p, '/profile', 6000);
   const profile = await p.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')];
      const hidden = imgs.filter((i) => {
         const r = i.getBoundingClientRect();
         return r.width < 2 || r.height < 2 || getComputedStyle(i).display === 'none';
      }).length;
      const folds = [...document.querySelectorAll('[aria-expanded]')].map((f) => ({ label: (f.textContent ?? '').trim().slice(0, 40), open: f.getAttribute('aria-expanded') }));
      const oldMark = [...document.querySelectorAll('svg path')].filter((path) => (path.getAttribute('d') ?? '').startsWith('M2 30c10-14')).length;
      return { imgs: imgs.length, hidden, folds, oldDrawnFish: oldMark, page: document.documentElement.scrollHeight };
   });
   console.log(name, 'PROFILE', JSON.stringify(profile));
   await shot(p, `${TAG}-${name}-profile`);

   /* ---- the map: controls that sit on top of one another ---- */
   await open(p, '/map', 9000);
   const map = await p.evaluate(() => {
      const boxes = [];
      const add = (label, el) => {
         if (!el) return;
         const r = el.getBoundingClientRect();
         if (r.width < 4) return;
         boxes.push({ label, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), z: getComputedStyle(el).zIndex });
      };
      add('zoom', document.querySelector('.leaflet-control-zoom'));
      add('attribution', document.querySelector('.leaflet-control-attribution'));
      [...document.querySelectorAll('.map-surface button, .map-surface a')].forEach((el, i) =>
         add(`ctrl:${(el.textContent ?? el.getAttribute('aria-label') ?? i).trim().slice(0, 18)}`, el)
      );
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++)
         for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], c = boxes[j];
            const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
            const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
            if (ox > 2 && oy > 2) overlaps.push(`${a.label} over ${c.label} (${Math.round(ox)}x${Math.round(oy)})`);
         }
      return { boxes, overlaps };
   });
   console.log(name, 'MAP', JSON.stringify(map, null, 1));
   await shot(p, `${TAG}-${name}-map`, { x: 0, y: 0, ...vp });

   /* ---- weight ---- */
   const by = {};
   for (const r of res) by[r.type] = (by[r.type] ?? 0) + r.bytes;
   const big = res.filter((r) => r.bytes > 120000).sort((a, c) => c.bytes - a.bytes).slice(0, 8);
   console.log(name, 'WEIGHT kB', JSON.stringify(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round(v / 1024)]))), 'elapsed', Date.now() - t0);
   console.log(name, 'BIGGEST', JSON.stringify(big.map((x) => `${x.type} ${Math.round(x.bytes / 1024)}kB ${x.url}`), null, 1));
   await ctx.close();
}
await b.close();
