import { launch, context, open, signIn, shot, PHONE, rect } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

await signIn(page);

/* The view, every 700ms from navigation, to see how many times it moves. */
await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
const views = [];
for (let i = 0; i < 8; i++) {
   await page.waitForTimeout(600);
   views.push(await page.evaluate(() => {
      const w = window;
      return w.__view ?? null;
   }).catch(() => null));
}
await page.waitForTimeout(500);

const state = await page.evaluate(() => ({
   pins: {
      spot: document.querySelectorAll('.map-pin-spot').length,
      other: document.querySelectorAll('.map-pin-other').length,
      cluster: document.querySelectorAll('.map-pin-cluster').length,
      found: document.querySelectorAll('.map-pin-found').length,
   },
   bar: (() => { const b = document.querySelector('.grid.grid-cols-4'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), cells: b.children.length, text: b.innerText.replace(/\n/g, ' | ') }; })(),
   search: (() => { const s = document.querySelector('input[type=search]'); if (!s) return null; const r = s.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), font: getComputedStyle(s).fontSize }; })(),
   zoomButtons: document.querySelectorAll('[aria-label="Zoom in"], [aria-label="Zoom out"]').length,
   body: document.body.innerText.replace(/\n+/g, ' | ').slice(0, 400),
   scrollW: document.documentElement.scrollWidth,
   innerW: window.innerWidth,
}));

console.log(JSON.stringify({ state, errors }, null, 2));
await shot(page, 'map-open-phone', { x: 0, y: 0, ...PHONE });
await browser.close();
