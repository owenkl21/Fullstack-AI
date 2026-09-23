import { launch, context, open, signIn, shot, PHONE } from '../lib.mjs';
const b = await launch();
const ctx = await context(b, PHONE);
const page = await ctx.newPage();
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) console.log('HTTP', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
page.on('pageerror', (e) => console.log('PAGE ERROR:', String(e).slice(0, 200)));
await signIn(page);

/* Settings: save with nothing changed, which must leave the page as it was. */
await open(page, '/profile', 3500);
await page.click('button:has-text("Edit your profile")');
await page.waitForTimeout(800);
await page.click('button[type=submit]');
await page.waitForTimeout(2500);
const after = await page.evaluate(() => document.body.innerText);
console.log('save says      :', (after.match(/saved[^\n]*/i) ?? ['(no line)'])[0]);
console.log('name still     :', (after.match(/owen kleinhans/i) ?? ['(gone)'])[0]);
console.log('since still    :', (after.match(/(fishing since|joined)[^\n]*/i) ?? ['(none)'])[0]);
console.log('photos still   :', (after.match(/\d+ photos/i) ?? ['(none)'])[0]);
await shot(page, 'profile-saved-phone');

/* Another angler: follow, then put it back. */
await open(page, '/anglers/seed_angler_karen', 3000);
const read = async () => page.evaluate(() => ({
   button: document.querySelector('[aria-pressed]')?.textContent?.trim(),
   followers: (document.body.innerText.match(/(\d+)\s*\n?\s*followers?/i) ?? [])[1],
}));
console.log('before         :', JSON.stringify(await read()));
await page.click('[aria-pressed]');
await page.waitForTimeout(2000);
console.log('after click    :', JSON.stringify(await read()));
await page.click('[aria-pressed]');
await page.waitForTimeout(2000);
console.log('put back       :', JSON.stringify(await read()));
await shot(page, 'profile-angler-follow-phone');
await b.close();
