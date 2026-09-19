import { launch, context, open, signIn, shot, DESK, PHONE } from './lib.mjs';

/*
 * The clocks on the forecast.
 *
 * Three of them used to disagree on one moment: the Right now block printed
 * Open-Meteo's bare UTC hour as if it were the local clock (two hours behind
 * in South Africa), the line under the hours printed the fetch time on the
 * reader's clock while naming the place's zone beside it, and Read again
 * never left the browser's cache.
 *
 * This checks all three at Kommetjie and at Mauritius, then fakes the clock
 * forward to see the page tick and to see a tab coming back from the
 * background ask again.
 */
const KOMMETJIE = '/forecast?lat=-34.1300&lng=18.3300&name=Kommetjie';
const MAURITIUS = '/forecast?lat=-20.3000&lng=57.5500&name=Mauritius';

const results = [];
const check = (name, ok, detail = '') => {
   results.push({ name, ok, detail });
   console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`
   );
};

/* The clock at a place, from this machine's own idea of the moment. */
const clockIn = (zone, at = new Date()) =>
   new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
   }).format(at);

const minutes = (text) => {
   const m = /(\d{2}):(\d{2})/.exec(text || '');
   return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const readBlock = async (p) => {
   const right = await p
      .locator('section[aria-label="Right now"] p')
      .first()
      .textContent()
      .catch(() => null);
   const foot = await p
      .getByText(/Weather data by Open-Meteo/)
      .first()
      .textContent()
      .catch(() => null);
   const nowColumn = await p.evaluate(() => {
      const th = [...document.querySelectorAll('th[data-hour]')].find((el) =>
         /now/.test(el.textContent || '')
      );
      return th ? (th.textContent || '').replace(/\D/g, '') : null;
   });
   return { right, foot, nowColumn };
};

const b = await launch();
let session;
for (const [vp, size] of [
   ['phone', PHONE],
   ['desk', DESK],
]) {
   const ctx = await context(b, size, session ? { storageState: session } : {});
   const p = await ctx.newPage();
   const errs = [];
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   if (!session) {
      await signIn(p);
      session = await ctx.storageState();
   }

   /* ---- Kommetjie, where the reader is ---- */
   await open(p, KOMMETJIE, 6000);
   const sa = await readBlock(p);
   const saNow = clockIn('Africa/Johannesburg');
   console.log(vp, 'SAST', saNow, JSON.stringify(sa));
   check(
      `${vp} SA: Right now reads this hour on the SA clock`,
      sa.right === `Read ${saNow.slice(0, 2)}:00`,
      `${sa.right} against ${saNow}`
   );
   check(
      `${vp} SA: the now column is this hour`,
      sa.nowColumn === saNow.slice(0, 2),
      `${sa.nowColumn} against ${saNow.slice(0, 2)}`
   );
   const checkedSa = minutes(sa.foot);
   const nowSa = minutes(saNow);
   check(
      `${vp} SA: the line under the hours says Checked, within the hour`,
      /^Checked \d{2}:\d{2}, hours in Africa\/Johannesburg\./.test(
         (sa.foot || '').trim()
      ) &&
         checkedSa !== null &&
         nowSa - checkedSa >= 0 &&
         nowSa - checkedSa <= 15,
      `${(sa.foot || '').slice(0, 60)} against ${saNow}`
   );
   await shot(p, `fix-readat-${vp}`);

   /* ---- Mauritius, two hours ahead of the reader ---- */
   await open(p, MAURITIUS, 6000);
   const mu = await readBlock(p);
   const muNow = clockIn('Indian/Mauritius');
   console.log(vp, 'Mauritius', muNow, JSON.stringify(mu));
   check(
      `${vp} Mauritius: Right now reads the hour there`,
      mu.right === `Read ${muNow.slice(0, 2)}:00`,
      `${mu.right} against ${muNow}`
   );
   check(
      `${vp} Mauritius: the now column is the hour there`,
      mu.nowColumn === muNow.slice(0, 2),
      `${mu.nowColumn} against ${muNow.slice(0, 2)}`
   );
   const checkedMu = minutes(mu.foot);
   const nowMu = minutes(muNow);
   check(
      `${vp} Mauritius: Checked is on the place's clock, not the reader's`,
      /hours in Indian\/Mauritius\./.test(mu.foot || '') &&
         checkedMu !== null &&
         nowMu - checkedMu >= 0 &&
         nowMu - checkedMu <= 15,
      `${(mu.foot || '').slice(0, 60)} against ${muNow}`
   );
   await shot(p, `fix-readat-mauritius-${vp}`);

   /* ---- Read again has to leave the tab ---- */
   await open(p, KOMMETJIE, 6000);
   await p.evaluate(() => performance.clearResourceTimings());
   await p
      .getByRole('button', { name: /^Read again$/ })
      .first()
      .click();
   await p.waitForTimeout(4000);
   const calls = await p.evaluate(() =>
      performance
         .getEntriesByType('resource')
         .filter((e) => /\/api\/forecast/.test(e.name))
         .map((e) => ({
            name: e.name.slice(e.name.indexOf('/api')),
            bytes: e.transferSize,
            ms: Math.round(e.duration),
         }))
   );
   console.log(vp, 'read again:', JSON.stringify(calls));
   check(
      `${vp} Read again leaves the browser and reaches the server`,
      calls.length > 0 && calls.some((c) => c.bytes > 0),
      JSON.stringify(calls)
   );
   check(
      `${vp} Read again asks a new address, past the cached one`,
      calls.some((c) => /[?&]t=\d+/.test(c.name)),
      calls.map((c) => c.name).join(' ')
   );

   /* ---- the clock ticks, and a tab coming back asks again ---- */
   const p2 = await ctx.newPage();
   p2.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   /* Resource timings are no use behind a faked clock, so the calls are
      counted off the wire instead. */
   const asked = [];
   p2.on('request', (r) => {
      if (/\/api\/forecast/.test(r.url())) {
         asked.push(r.url().slice(r.url().indexOf('/api')));
      }
   });
   await p2.clock.install({ time: new Date() });
   await open(p2, KOMMETJIE, 6000);
   const before = await readBlock(p2);
   await p2.clock.fastForward('01:00:00');
   await p2.waitForTimeout(1500);
   const after = await readBlock(p2);
   const moved =
      before.nowColumn !== null &&
      after.nowColumn !== null &&
      (Number(before.nowColumn) + 1) % 24 === Number(after.nowColumn);
   check(
      `${vp} the hour band moves with the clock, without a reload`,
      moved,
      `${before.nowColumn} then ${after.nowColumn}`
   );

   const asleep = asked.length;
   await p2.clock.fastForward('00:10:00');
   await p2.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange'))
   );
   await p2.waitForTimeout(4000);
   const woke = asked.slice(asleep);
   const stillThere = await p2
      .locator('#forecast-day')
      .count()
      .catch(() => 0);
   check(
      `${vp} a tab back from the background reads again, in place`,
      woke.some((url) => /[?&]t=\d+/.test(url)) && stillThere > 0,
      `${JSON.stringify(woke)}, day panel ${stillThere}`
   );
   await p2.close();

   console.log(vp, 'page errors:', errs.length ? errs : 'none');
   await ctx.close();
}
await b.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
