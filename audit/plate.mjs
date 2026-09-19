import { chromium } from 'playwright';
const HOST = process.env.HOST || 'https://fishlogger-client.vercel.app';
const OUT = process.env.OUT;
const b = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
const passChallenge = async (page) => { for (let i = 0; i < 10; i++) { if (!/Security Checkpoint/.test(await page.title())) return; await page.waitForTimeout(1500); } };
for (const [name, vp] of [['desk', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(HOST + '/forecast', { waitUntil: 'load', timeout: 60000 }); await passChallenge(p); await p.waitForTimeout(6000);
  const m = await p.evaluate(() => {
    const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), h: Math.round(q.height), w: Math.round(q.width) }; };
    const head = document.querySelector('main header.bg-black-block');
    const cbox = head?.querySelector('.plate-art');
    const csvg = head?.querySelector('svg.contour');
    const torn = head?.querySelector('.torn');
    const next = head?.nextElementSibling;
    return { head: r(head), contourBox: r(cbox), contourSvg: r(csvg), torn: r(torn), next: r(next), nextTag: next?.tagName, nextClass: next?.className?.toString().slice(0, 80), paths: csvg?.querySelectorAll('path').length };
  });
  console.log(name, JSON.stringify(m));
  const bottom = (m.torn?.bottom ?? 400) + 120;
  await p.screenshot({ path: `${OUT}/${process.env.TAG||'live'}-${name}-plate.png`, clip: { x: 0, y: 0, width: vp.width, height: Math.min(bottom, 1000) } });
  await ctx.close();
}
await b.close();
