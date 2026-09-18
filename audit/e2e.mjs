import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

/*
 * The whole app on a phone, touched rather than loaded.
 *
 * Every check here is a thing a reader would notice: a control that does
 * nothing, text cut off, something under the bar, a page that scrolls
 * sideways, an error in the console. It writes a numbered screenshot at every
 * step so a fault can be looked at rather than argued about.
 */
const TAG = process.env.TAG || 'e2e';
const faults = [];
let step = 0;

const note = (where, what) => {
   faults.push(`${where}: ${what}`);
   console.log(`  FAULT  ${where}: ${what}`);
};

async function frame(p, name) {
   step += 1;
   await shot(p, `${TAG}-${String(step).padStart(2, '0')}-${name}`, {
      x: 0,
      y: 0,
      ...PHONE,
   });
}

/* The faults a page can have without anyone touching it. */
async function inspect(p, where) {
   const m = await p.evaluate(() => {
      const de = document.documentElement;
      const bar = document.querySelector('nav, [class*="fixed"][class*="bottom-0"]');
      const barTop = bar ? bar.getBoundingClientRect().top : innerHeight;

      /* Text clipped by a box that cannot scroll. */
      const cut = [];
      for (const el of document.querySelectorAll('main *')) {
         const cs = getComputedStyle(el);
         if (cs.overflow === 'visible' || cs.overflowY === 'auto' || cs.overflowY === 'scroll') continue;
         if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0 && (el.textContent ?? '').trim()) {
            cut.push((el.textContent ?? '').trim().slice(0, 34));
         }
      }

      /* A control covered by something that is not its own child. */
      const covered = [];
      for (const el of document.querySelectorAll('main button, main a[href], main input, main select')) {
         const r = el.getBoundingClientRect();
         if (r.height < 8 || r.top < 0 || r.bottom > innerHeight) continue;
         const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
         if (!at || at === el || el.contains(at) || at.contains(el)) continue;
         covered.push(`${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 18)} under ${at.tagName.toLowerCase()}`);
      }

      /* Anything wider than the screen. */
      const wide = [];
      for (const el of document.querySelectorAll('main *')) {
         const r = el.getBoundingClientRect();
         if (r.width > innerWidth + 4 && r.height > 8) {
            wide.push(`${el.tagName.toLowerCase()}.${(el.className?.toString?.() ?? '').slice(0, 26)} ${Math.round(r.width)}px`);
         }
      }

      /* A target too small to hit with a thumb. */
      const small = [];
      for (const el of document.querySelectorAll('main button, main a[href]')) {
         const r = el.getBoundingClientRect();
         if (r.height > 0 && r.height < 40 && (el.textContent ?? '').trim() && !el.closest('p, li')) {
            small.push(`${(el.textContent ?? '').trim().slice(0, 18)} ${Math.round(r.height)}px`);
         }
      }

      return {
         sideways: de.scrollWidth > de.clientWidth + 2,
         boundary: /did not load|went wrong|Not found|something went/i.test(document.body.innerText.slice(0, 300)),
         barTop: Math.round(barTop),
         cut: [...new Set(cut)].slice(0, 3),
         covered: [...new Set(covered)].slice(0, 3),
         wide: [...new Set(wide)].slice(0, 3),
         small: [...new Set(small)].slice(0, 4),
      };
   });
   if (m.boundary) note(where, 'the page shows an error boundary');
   if (m.sideways) note(where, 'the page scrolls sideways');
   if (m.cut.length) note(where, `text cut off: ${JSON.stringify(m.cut)}`);
   if (m.covered.length) note(where, `control covered: ${JSON.stringify(m.covered)}`);
   if (m.wide.length) note(where, `wider than the screen: ${JSON.stringify(m.wide)}`);
   if (m.small.length) note(where, `target under 40px: ${JSON.stringify(m.small)}`);
   return m;
}

const tap = async (p, locator, what, where) => {
   try {
      const el = typeof locator === 'string' ? p.getByRole('button', { name: new RegExp(locator, 'i') }) : locator;
      if (!(await el.count())) {
         note(where, `no control found for "${what}"`);
         return false;
      }
      await el.first().click({ timeout: 8000 });
      await p.waitForTimeout(1200);
      return true;
   } catch (error) {
      note(where, `"${what}" could not be tapped: ${String(error).slice(0, 70)}`);
      return false;
   }
};

const b = await launch();
const ctx = await context(b, PHONE, { deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e).slice(0, 110)));
p.on('console', (m) => {
   if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) {
      errors.push(m.text().slice(0, 110));
   }
});

const check = async (where) => {
   if (errors.length) {
      note(where, `console: ${JSON.stringify([...new Set(errors)].slice(0, 2))}`);
      errors.length = 0;
   }
};

console.log('== signing in');
await signIn(p);

/* ---------------- the feed ---------------- */
console.log('== feed');
await open(p, '/', 8000);
await inspect(p, 'feed');
await frame(p, 'feed');
await p.evaluate(() => window.scrollBy(0, 1400));
await p.waitForTimeout(1500);
await inspect(p, 'feed scrolled');
await frame(p, 'feed-scrolled');
await tap(p, p.locator('article button[aria-label="Like"], article button[aria-label="Liked"]'), 'like', 'feed');
await tap(p, p.locator('article button[aria-label="Comments"]'), 'comments', 'feed');
await p.waitForTimeout(1200);
await inspect(p, 'feed comments open');
await frame(p, 'feed-comments');
await check('feed');

/* ---------------- a catch record ---------------- */
console.log('== catch record');
await open(p, '/', 6000);
if (await tap(p, p.getByRole('link', { name: /see the catch/i }), 'see the catch', 'feed')) {
   await p.waitForTimeout(2000);
   await inspect(p, 'catch record');
   await frame(p, 'catch-record');
   await check('catch record');
}

/* ---------------- the quick log ---------------- */
console.log('== quick log');
await open(p, '/log', 7000);
await inspect(p, 'log step 1');
await frame(p, 'log-1');
await tap(p, p.getByRole('button', { name: /move the pin/i }), 'move the pin', 'log step 1');
await p.waitForTimeout(2000);
await inspect(p, 'log map open');
await frame(p, 'log-map');
const dragged = await p.evaluate(() => Boolean(document.querySelector('.leaflet-marker-icon')));
if (!dragged) note('log step 1', 'no draggable pin on the map');
await tap(p, 'next', 'next', 'log step 1');
await inspect(p, 'log step 2');
await frame(p, 'log-2');
await tap(p, 'next', 'next', 'log step 2');
await inspect(p, 'log step 3');
await frame(p, 'log-3');
await check('quick log');

/* ---------------- the map ---------------- */
console.log('== map');
await open(p, '/map', 9000);
const map = await p.evaluate(() => {
   const el = document.querySelector('.leaflet-container');
   const r = el?.getBoundingClientRect();
   return r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), share: Math.round((r.height / innerHeight) * 100) } : null;
});
console.log('  map box', JSON.stringify(map));
if (!map || map.h < 300) note('map', `the map is ${map ? map.h : 0}px tall`);
if (map && map.share < 55) note('map', `the map is only ${map.share}% of the screen`);
await inspect(p, 'map');
await frame(p, 'map');
/* Search for a place that is not a town. */
const search = p.locator('input[type="search"], input[placeholder*="beach" i], input[placeholder*="town" i]').first();
if (await search.count()) {
   for (const q of ['Rooi-Els', 'Kanu', 'Theewaterskloof']) {
      await search.fill(q);
      await p.waitForTimeout(2500);
      const hits = await p.evaluate(() => {
         const list = [...document.querySelectorAll('li, [role="option"]')]
            .map((el) => (el.textContent ?? '').trim())
            .filter((t) => t.length > 2 && t.length < 90);
         return list.slice(0, 4);
      });
      console.log(`  search "${q}" ->`, JSON.stringify(hits));
      if (!hits.length) note('map search', `"${q}" found nothing`);
   }
   await frame(p, 'map-search');
}
await check('map');

/* ---------------- the forecast ---------------- */
console.log('== forecast');
await open(p, '/forecast', 6000);
await tap(p, p.getByRole('button', { name: /where i am/i }), 'where i am', 'forecast');
await p.waitForTimeout(7000);
await inspect(p, 'forecast');
await frame(p, 'forecast');
await tap(p, p.getByRole('tab', { name: /sat|sun|mon/i }), 'another day', 'forecast');
await inspect(p, 'forecast other day');
await tap(p, p.getByRole('button', { name: /more readings/i }), 'more readings', 'forecast');
await p.waitForTimeout(900);
await inspect(p, 'forecast more');
await frame(p, 'forecast-more');
await check('forecast');

/* ---------------- the rest ---------------- */
for (const [route, name] of [
   ['/catches/me', 'my catches'],
   ['/sites/me', 'my spots'],
   ['/gear/me', 'my gear'],
   ['/profile', 'profile'],
   ['/insights', 'insights'],
   ['/boards', 'boards'],
   ['/competitions', 'competitions'],
   ['/saved', 'kept'],
   ['/notifications', 'notifications'],
]) {
   console.log('==', name);
   await open(p, route, 6000);
   await inspect(p, name);
   await frame(p, name.replace(/\s+/g, '-'));
   await check(name);
}

console.log('\n================ ' + faults.length + ' faults ================');
faults.forEach((f) => console.log('- ' + f));
await b.close();
