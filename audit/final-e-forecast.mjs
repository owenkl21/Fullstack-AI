import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';

const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const api = [];
page.on('response', async (r) => {
   const u = r.url();
   if (/\/api\/(forecast|weather)/.test(u) || /open-meteo/.test(u)) {
      try {
         api.push({ url: u.slice(0, 120), body: await r.json() });
      } catch {
         api.push({ url: u.slice(0, 120), body: null });
      }
   }
});
await signIn(page);
await open(page, '/forecast', 7000);

const pass = (n, ok, note = '') =>
   console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);

const seen = await page.evaluate(() => {
   const t = document.body.innerText;
   return {
      read: (t.match(/Read \d{2}:\d{2}/) || [null])[0],
      checked: (t.match(/Checked[^\n]*/) || [null])[0],
      nowHeading: (t.match(/Right now[^\n]*/) || [null])[0],
   };
});
console.log('on screen:', JSON.stringify(seen));
console.log('--- page text ---');
console.log(
   (await page.evaluate(() => document.body.innerText)).slice(0, 1400)
);
console.log('--- end ---');

const sast = new Intl.DateTimeFormat('en-ZA', {
   timeZone: 'Africa/Johannesburg',
   hour: '2-digit',
   minute: '2-digit',
   hour12: false,
}).format(new Date());
console.log('Africa/Johannesburg now:', sast);

const conditions = api.filter((a) => /weather|open-meteo/.test(a.url)).pop();
const forecast = api.filter((a) => /\/api\/forecast/.test(a.url)).pop();
if (conditions?.body) {
   const snap =
      conditions.body.weather ?? conditions.body.snapshot ?? conditions.body;
   console.log('conditions observedAt from the API:', snap?.observedAt);
   if (snap?.observedAt) {
      const s = String(snap.observedAt);
      const asUtc = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + 'Z';
      const inSast = new Intl.DateTimeFormat('en-ZA', {
         timeZone: 'Africa/Johannesburg',
         hour: '2-digit',
         minute: '2-digit',
         hour12: false,
      }).format(new Date(asUtc));
      console.log('that reading on the Johannesburg clock:', inSast);
      pass(
         'Read matches the reading, on the Johannesburg clock',
         seen.read === `Read ${inSast}`,
         `${seen.read} vs Read ${inSast}`
      );
      const mins = Math.round((Date.now() - new Date(asUtc).getTime()) / 60000);
      pass(
         'the reading is the latest (within the hour it stamps)',
         mins >= -5 && mins <= 65,
         `${mins} minutes old`
      );
   }
}
if (forecast?.body?.forecast) {
   const f = forecast.body.forecast;
   console.log(
      'forecast issuedAt:',
      f.issuedAt,
      'utcOffsetSeconds:',
      f.utcOffsetSeconds
   );
   const inSast = new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
   }).format(new Date(f.issuedAt));
   pass(
      'Checked matches when the forecast was issued, on the Johannesburg clock',
      (seen.checked || '').includes(inSast),
      `${seen.checked} vs ${inSast}`
   );
   pass(
      'the place reports the SA offset',
      f.utcOffsetSeconds === 7200,
      String(f.utcOffsetSeconds)
   );
}

/* Read again really asks again */
const before = seen.read;
const again = page
   .locator('button:visible', { hasText: /^Read again$/ })
   .first();
if (await again.count()) {
   const n = api.length;
   await again.click();
   await page.waitForTimeout(6000);
   pass(
      '"Read again" asks the server again',
      api.length > n,
      `${api.length - n} new requests`
   );
   const after = await page.evaluate(
      () => (document.body.innerText.match(/Read \d{2}:\d{2}/) || [null])[0]
   );
   console.log('   Read line after a re-read:', after, '(was', before + ')');
} else {
   console.log('   no "Read again" control on screen');
}

await shot(page, 'final-forecast-phone', { x: 0, y: 0, ...PHONE });
console.log('\npage errors:', errors.length ? errors : 'none');
console.log('requests seen:', api.map((a) => a.url).join('\n  '));
await browser.close();
