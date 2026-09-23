import { chromium } from 'playwright';
/* Load the real domain with DNS forced past this machine's stale cache, and
   see whether the app itself boots, not just the HTML shell. */
const browser = await chromium.launch({
   args: [
      '--disable-blink-features=AutomationControlled',
      '--host-resolver-rules=MAP fisherfeed.com 216.150.1.1, MAP www.fisherfeed.com 216.150.1.1',
   ],
});
const pass = (n, ok, note = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? '  ' + note : ''}`);
for (const host of ['https://fisherfeed.com', 'https://www.fisherfeed.com']) {
   const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
   const page = await ctx.newPage();
   const bad = [];
   page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(-40)}`); });
   await page.goto(host + '/feed', { waitUntil: 'load', timeout: 45000 });
   await page.waitForTimeout(4000);
   const seen = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      word: document.querySelector('header a[aria-label]')?.textContent?.trim(),
      markLoaded: (() => { const i = document.querySelector('header img'); return i ? i.naturalWidth > 0 : false; })(),
      rootFilled: (document.getElementById('root')?.children.length ?? 0) > 0,
      body: (document.body.innerText || '').slice(0, 60).replace(/\n/g, ' '),
   }));
   console.log(`== ${host} ==`, JSON.stringify(seen));
   pass(`${host} the app boots`, seen.rootFilled && seen.word === 'Fisherfeed' && seen.markLoaded);
   pass(`${host} nothing fails to load`, bad.filter((b) => !/401|403/.test(b)).length === 0, bad.slice(0, 3).join(' | '));
   await ctx.close();
}
await browser.close();
