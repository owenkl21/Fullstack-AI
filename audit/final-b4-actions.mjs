import { launch, context, open, signIn, PHONE } from './lib.mjs';
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await signIn(page);
const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);

const find = async (what) => {
   await open(page, '/map', 4500);
   const field = page.locator('input[type=search]').first();
   await field.fill(what);
   await page.waitForTimeout(2600);
   const rows = page
      .locator('[role=option], li button, ul button')
      .filter({ hasText: new RegExp(what.split(' ')[0], 'i') });
   if (!(await rows.count())) throw new Error('no rows for ' + what);
   await rows.first().click();
   await page.waitForTimeout(2500);
};

/* Log a catch here */
await find('Kalk Bay');
await page
   .locator('button:visible', { hasText: /^Log a catch here$/i })
   .first()
   .click();
await page.waitForTimeout(4000);
const url = page.url();
pass(
   '"Log a catch here" opens the log on that place',
   /\/log\?/.test(url) && /lat=-34\.12/.test(url),
   url
);
const line = await page.evaluate(
   () => (document.body.innerText.match(/From [^\n]*/) || [''])[0]
);
console.log('   the line under the map on the log:', JSON.stringify(line));
pass('the log says the place came from the map', /map/i.test(line), line);

/* Forecast */
await find('Kalk Bay');
await page
   .locator('button:visible', { hasText: /^Forecast$/i })
   .first()
   .click();
await page.waitForTimeout(5000);
pass(
   '"Forecast" opens the forecast for that place',
   /\/forecast\?/.test(page.url()),
   page.url()
);
const head = await page.evaluate(() =>
   (document.querySelector('h1')?.textContent || '').trim()
);
console.log('   the forecast heading:', JSON.stringify(head));

/* Dismiss */
await find('Kalk Bay');
await page
   .locator('button:visible', { hasText: /^Dismiss$/i })
   .first()
   .click();
await page.waitForTimeout(1200);
const gone = await page.evaluate(
   () => !document.querySelector('[role=dialog][data-state=open]')
);
pass('"Dismiss" puts the card away', gone);

/* Save as a spot offers a name field, without saving anything */
await find('Kalk Bay');
await page
   .locator('button:visible', { hasText: /^Save as a spot$/i })
   .first()
   .click();
await page.waitForTimeout(1200);
const namer = await page.evaluate(() => {
   const d =
      document.querySelector('[role=dialog][data-state=open]') || document.body;
   const input = [...d.querySelectorAll('input')].find(
      (i) => i.type !== 'search' && i.offsetParent
   );
   return input
      ? {
           value: input.value,
           label:
              input.getAttribute('aria-label') ||
              input.getAttribute('placeholder') ||
              '',
        }
      : null;
});
pass(
   '"Save as a spot" asks for a name, prefilled with the place',
   !!namer && /Kalk/i.test(namer.value),
   JSON.stringify(namer)
);
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
