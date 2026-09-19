import { launch, context, signIn, shot, PHONE, DESK, rect } from './lib.mjs';

const browser = await launch();

/* ---------------- desktop map ---------------- */
{
   const ctx = await context(browser, DESK);
   const page = await ctx.newPage();
   const errors = [];
   page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
   await signIn(page);
   await page.goto('http://localhost:5199/map', { waitUntil: 'load' });
   await page.waitForTimeout(4000);

   const layout = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), left: Math.round(q.left), right: Math.round(q.right), w: Math.round(q.width), h: Math.round(q.height) }; };
      const toolbar = [...document.querySelectorAll('div')].find((d) => String(d.className).includes('bottom-8 left-3'));
      return {
         surface: r(document.querySelector('.map-surface')),
         search: r(document.querySelector('input[type=search]')),
         toolbar: r(toolbar),
         toolbarText: toolbar?.innerText.replace(/\n+/g, ' | '),
         zoom: r(document.querySelector('.leaflet-control-zoom')),
         attribution: r(document.querySelector('.leaflet-control-attribution')),
         scrollH: document.documentElement.scrollHeight,
         innerH: window.innerHeight,
         headings: [...document.querySelectorAll('main h1, main h2, main p')].map((e) => e.innerText.slice(0, 60)).slice(0, 6),
      };
   });
   console.log('== DESK LAYOUT ==\n', JSON.stringify(layout, null, 1));
   await shot(page, 'map-open-desk', { x: 0, y: 0, ...DESK });

   /* a spot pin still opens its popover on a desktop */
   await page.waitForTimeout(500);
   const pin = page.locator('.map-pin-spot, .map-pin-cluster').first();
   await pin.click();
   await page.waitForTimeout(1200);
   const pin2 = page.locator('.map-pin-spot').first();
   if (await pin2.count()) { await pin2.click(); await page.waitForTimeout(1000); }
   const popup = await page.evaluate(() => {
      const p = document.querySelector('.leaflet-popup');
      return p ? { text: p.innerText.replace(/\n+/g, ' | ').slice(0, 160) } : null;
   });
   console.log('desk popup:', JSON.stringify(popup));
   await shot(page, 'map-pin-desk', { x: 0, y: 0, ...DESK });

   /* layers popover */
   await page.keyboard.press('Escape');
   await page.getByRole('button', { name: /Satellite|Terrain|Plain|Streets/ }).first().click();
   await page.waitForTimeout(700);
   console.log('layers popover:', JSON.stringify((await page.evaluate(() => document.querySelector('[data-radix-popper-content-wrapper]')?.innerText.replace(/\n+/g, ' | ').slice(0, 220))) ?? null));
   await shot(page, 'map-layers-desk', { x: 0, y: 0, ...DESK });
   console.log('errors:', JSON.stringify(errors.slice(0, 5)));
   await ctx.close();
}

/* ---------------- the log's own picker ---------------- */
for (const [size, tag] of [[PHONE, 'phone'], [DESK, 'desk']]) {
   const ctx = await context(browser, size);
   const page = await ctx.newPage();
   const errors = [];
   page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
   await signIn(page);
   await page.goto('http://localhost:5199/log', { waitUntil: 'load' });
   await page.waitForTimeout(4000);

   const before = await page.evaluate(() => {
      const surf = document.querySelector('.map-surface');
      const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), left: Math.round(q.left), right: Math.round(q.right), h: Math.round(q.height) }; };
      const controls = [...document.querySelectorAll('.map-surface button')].map((b) => ({ label: b.getAttribute('aria-label')?.slice(0, 28) ?? b.innerText, ...r(b) }));
      const bar = [...document.querySelectorAll('button')].find((b) => /^next$/i.test(b.innerText.trim()));
      return { surface: r(surf), controls, next: r(bar), pin: document.querySelector('[data-pin]')?.getAttribute('data-pin'), source: document.querySelector('[data-source]')?.getAttribute('data-source') };
   });
   console.log(`\n== LOG PICKER ${tag} ==\n`, JSON.stringify(before, null, 1));
   await shot(page, `map-log-picker-${tag}`, { x: 0, y: 0, ...size });

   /* open the search and type a pair */
   const openSearch = page.locator('.map-surface button[aria-label="Search for a place"]');
   if (await openSearch.count()) { await openSearch.click(); await page.waitForTimeout(500); }
   const field = page.locator('input[aria-label^="Search a place"]').first();
   await field.click();
   await field.fill('-34.1275, 18.4487');
   await page.keyboard.press('Enter');
   await page.waitForTimeout(1600);
   const pair = await page.evaluate(() => ({
      pin: document.querySelector('[data-pin]')?.getAttribute('data-pin'),
      notes: [...document.querySelectorAll('p')].map((p) => p.innerText).filter((t) => /pin|link|search/i.test(t)).slice(0, 4),
   }));
   console.log('typed pair ->', JSON.stringify(pair));

   /* paste a link */
   await field.click();
   await field.fill('');
   await page.evaluate((text) => {
      const input = document.querySelector('input[aria-label^="Search a place"]');
      input.focus();
      const dt = new DataTransfer();
      dt.setData('text', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
   }, 'https://www.google.com/maps/@-34.0964,18.3086,15z');
   await page.waitForTimeout(1600);
   console.log('pasted link ->', JSON.stringify(await page.evaluate(() => ({
      pin: document.querySelector('[data-pin]')?.getAttribute('data-pin'),
      notes: [...document.querySelectorAll('p')].map((p) => p.innerText).filter((t) => /pin|link/i.test(t)).slice(0, 3),
   }))));
   await shot(page, `map-log-search-${tag}`, { x: 0, y: 0, ...size });
   console.log('errors:', JSON.stringify(errors.slice(0, 5)));
   await ctx.close();
}

await browser.close();
