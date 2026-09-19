import { launch, context, open, signIn, shot, PHONE, DESK } from '../lib.mjs';

const size = process.argv[2] === 'phone' ? PHONE : DESK;
const tag = process.argv[2] === 'phone' ? 'phone' : 'desk';

const b = await launch();
const ctx = await context(b, size);
const page = await ctx.newPage();
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) console.log('HTTP', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 160)); });
await signIn(page);
await open(page, '/insights', 4000);

const text = await page.evaluate(() => document.body.innerText);
const grab = (re) => (text.match(re) ?? ['(none)'])[0];
console.log('header aside   :', grab(/\d+ logs[^\n]*/i));
console.log('conditions note:', grab(/counted from[^\n]*/i));
console.log('wind sentence  :', grab(/most fish on[^\n]*/i));
console.log('water labels   :', JSON.stringify(await page.$$eval('[aria-label^="Water"]', (n) => n.map((e) => e.getAttribute('aria-label')))));
console.log('chart labels   :', JSON.stringify(await page.$$eval('[aria-label]', (n) => n.map((e) => e.getAttribute('aria-label')).filter((l) => /^(Pressure|Sky|Day or night|Wind)/.test(l)))));
console.log('species links  :', JSON.stringify(await page.$$eval('a[href*="species"]', (n) => n.map((e) => e.getAttribute('href')))));
console.log('spot links     :', JSON.stringify(await page.$$eval('a[href^="/sites/"]', (n) => n.map((e) => e.getAttribute('href'))).catch(() => [])));
const tables = await page.$$eval('table', (ts) =>
   ts.map((t) => ({
      head: t.closest('div')?.querySelector('h3')?.textContent?.trim(),
      cellW: Math.round(t.querySelector('tbody td')?.getBoundingClientRect().width ?? 0),
      names: [...t.querySelectorAll('tbody tr')].slice(0, 4).map((r) => {
         const cell = r.querySelector('td');
         const inner = cell.firstElementChild ?? cell;
         return { text: inner.textContent.trim(), clipped: inner.scrollWidth > inner.clientWidth + 1 };
      }),
      lastShown: getComputedStyle(t.querySelector('tbody td:last-child')).display !== 'none',
   }))
);
console.log('tables         :', JSON.stringify(tables, null, 1));
console.log('season strip   :', grab(/the season[\s\S]{0,60}/i).replace(/\n/g, ' | '));
await shot(page, `profile-insights-${tag}`);
await b.close();
