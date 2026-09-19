import { launch, context, open, signIn, shot, PHONE, DESK } from '../lib.mjs';

const size = process.argv[2] === 'phone' ? PHONE : DESK;
const tag = process.argv[2] === 'phone' ? 'phone' : 'desk';

const b = await launch();
const ctx = await context(b, size);
const page = await ctx.newPage();
const calls = [];
page.on('request', (r) => {
   if (r.url().includes('/api/')) calls.push(r.url().replace(/^https?:\/\/[^/]+/, ''));
});
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) console.log('HTTP', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
page.on('console', (m) => {
   if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 200));
});
await signIn(page);

calls.length = 0;
await open(page, '/profile', 3500);
console.log('--- /profile api calls:', JSON.stringify(calls));
const text = await page.evaluate(() => document.body.innerText);
const grab = (re) => (text.match(re) ?? ['(none)'])[0];
console.log('since line     :', grab(/(fishing since|joined)[^\n]*/i));
console.log('log line       :', grab(/\d+ catches at[^\n]*/i));
console.log('longest line   :', grab(/longest so far[^\n]*/i));
console.log('photos fold    :', grab(/photographs[^\n]*/i));
console.log('fold open?     :', await page.$$eval('.fold', (n) => n.map((e) => ({ open: e.className.includes('fold-open'), head: e.innerText.split('\n').slice(0, 2).join(' | ') }))).then(JSON.stringify));
console.log('numbers error? :', /could not load your numbers/i.test(text));
console.log('grid labels    :', JSON.stringify(await page.$$eval('dl dt', (n) => n.map((e) => e.textContent.trim()))));
console.log('grid values    :', JSON.stringify(await page.$$eval('dl dd', (n) => n.map((e) => e.textContent.trim()))));
console.log('highlights     :', JSON.stringify(await page.$$eval('section ul li span.text-\\[15px\\]', (n) => n.map((e) => e.textContent.trim())).catch(() => [])));
console.log('best day line  :', grab(/[^\n]*best day[^\n]*/));
console.log('most caught    :', grab(/[^\n]*most caught[^\n]*/));
console.log('land most      :', grab(/[^\n]*land most[^\n]*/));
const gallery = await page.$$eval('a[href^="/catches/"] img', (n) => n.map((e) => ({ src: e.currentSrc.slice(0, 80), w: e.naturalWidth })));
console.log('gallery imgs   :', gallery.length, JSON.stringify(gallery.slice(0, 4)));
await shot(page, `profile-wired-${tag}`);

/* Followers sheet */
await page.click('button:has-text("Followers")');
await page.waitForTimeout(1200);
const rows = await page.$$eval('[role="dialog"] li a', (n) => n.map((e) => e.getAttribute('href')));
console.log('follower links :', JSON.stringify(rows));
await shot(page, `profile-followers-${tag}`);
if (rows.length) {
   await page.click('[role="dialog"] li a');
   await page.waitForTimeout(2500);
   console.log('after click url:', page.url());
   console.log('dialog open?   :', await page.$$eval('[role="dialog"]', (n) => n.length));
   const angler = await page.evaluate(() => document.body.innerText);
   console.log('angler since   :', (angler.match(/(fishing since|joined)[^\n]*/i) ?? ['(none)'])[0]);
   console.log('angler photos  :', (angler.match(/photographs[\s\S]{0,40}/i) ?? ['(none)'])[0].replace(/\n/g, ' | '));
   await shot(page, `profile-angler-${tag}`);
}
await b.close();
