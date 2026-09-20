import { mkdirSync } from 'node:fs';
import { launch, context, open, signIn } from './lib.mjs';

/*
 * Two checks the block itself cannot make.
 *
 * One: the line of facts under the spot's name carries the average once there
 * is one. Two: with the deployed API answering 404 for the reviews route, as
 * it does until this is shipped, the spot page still loads everything else and
 * the block says so in one line instead of taking the page down.
 */

const OUT = new URL('./shots/reviews/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SITE = process.env.SITE || 'seed_spot_bergriver';
const viewport =
   process.env.W === '1440'
      ? { width: 1440, height: 1000 }
      : { width: 390, height: 844 };
const tag = process.env.W === '1440' ? 'desk' : 'phone';

const browser = await launch();
const ctx = await context(browser, viewport);
const page = await ctx.newPage();
await signIn(page);

/* With an average. */
await page.route('**/api/sites/*/reviews**', (route) =>
   route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
         summary: {
            count: 5,
            average: 4.2,
            spread: [1, 2, 3, 4, 5].map((rating) => ({
               rating,
               count: { 3: 1, 4: 2, 5: 2 }[rating] ?? 0,
            })),
         },
         reviews: [],
         yours: null,
         viewer: { signedIn: true, isOwner: false, hasRated: false },
         offset: 0,
         limit: 20,
         hasMore: false,
         nextOffset: 0,
      }),
   })
);

await open(page, `/sites/${SITE}`, 2000);
await page.screenshot({
   path: `${OUT}/${tag}-facts.png`,
   clip: { x: 0, y: 0, ...viewport },
});
console.log(
   `${tag} facts ${JSON.stringify(
      await page.evaluate(() => {
         const line = document.querySelector('article p.num');
         return {
            facts: line ? line.textContent.trim() : null,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
         };
      })
   )}`
);

/* And now with the route as the deployed API actually answers it today. */
await page.unroute('**/api/sites/*/reviews**');
const codes = [];
page.on('response', (response) => {
   if (/\/reviews/.test(response.url())) codes.push(response.status());
});
await open(page, `/sites/${SITE}`, 2500);
await page.evaluate(() => {
   const heading = [...document.querySelectorAll('h2')].find((h) =>
      /What anglers make of it/.test(h.textContent)
   );
   if (heading)
      window.scrollTo(
         0,
         Math.max(0, heading.getBoundingClientRect().top + window.scrollY - 24)
      );
});
await page.waitForTimeout(600);
await page.screenshot({
   path: `${OUT}/${tag}-live404.png`,
   clip: { x: 0, y: 0, ...viewport },
});
console.log(
   `${tag} live ${JSON.stringify({
      codes,
      ...(await page.evaluate(() => ({
         catches: document.body.innerText.includes('Catches here'),
         said: document.body.innerText.includes('Could not load the ratings'),
         facts:
            document.querySelector('article p.num')?.textContent.trim() ?? null,
      }))),
   })}`
);

await ctx.close();
await browser.close();
