import { launch, context, open, signIn, shot, PHONE } from './lib.mjs';
const id = process.argv[2];
const browser = await launch();
const ctx = await context(browser, PHONE, { hasTouch: true });
const page = await ctx.newPage();
const errors = [], failed = [], logs = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 160)); });
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 120)}`); });
await signIn(page);
await open(page, `/catches/${id}`, 6000);
const info = await page.evaluate(() => {
   const imgs = [...document.querySelectorAll('main img, img')].map((i) => ({
      src: i.currentSrc.slice(0, 90), w: i.naturalWidth, h: i.naturalHeight, alt: i.alt.slice(0, 40),
      shown: i.getBoundingClientRect().width > 0,
   }));
   const text = document.body.innerText;
   const none = (text.match(/no photograph[^\n]*|no photo[^\n]*|no image[^\n]*|none[^\n]*/gi) || []).slice(0, 5);
   return { imgs, none, h1: document.querySelector('h1')?.textContent };
});
console.log(JSON.stringify(info, null, 1));
console.log('failed responses:', failed);
console.log('console:', logs.slice(0, 8));
console.log('page errors:', errors);
await shot(page, 'catch-img-phone');
await browser.close();
