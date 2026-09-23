import { mkdirSync } from 'node:fs';
import { launch, context, open, signIn } from './lib.mjs';

/*
 * The ratings block on a spot page, at 390 and at 1440.
 *
 * The dev server on 5199 proxies /api at the deployed API, which does not
 * carry the reviews routes yet, so the three states are served to the page
 * from here instead. Nothing is written to the live database by this script.
 */

const OUT = new URL('./shots/reviews/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SITE = process.env.SITE || 'seed_spot_bergriver';

const spread = (counts) =>
   [1, 2, 3, 4, 5].map((rating) => ({ rating, count: counts[rating] ?? 0 }));

const review = (id, name, rating, body, days) => ({
   id,
   rating,
   body,
   createdAt: new Date(Date.now() - days * 864e5).toISOString(),
   updatedAt: new Date(Date.now() - days * 864e5).toISOString(),
   user: { id: `u_${id}`, displayName: name, username: name.toLowerCase() },
});

const REVIEWS = [
   review(
      'r1',
      'Lerato Khumalo',
      5,
      'Fished it on a pushing tide in a light south easter and had grunter on almost every cast. Park at the second gate, the first one floods.',
      2
   ),
   review('r2', 'Sipho Ndlovu', 4, '', 6),
   review(
      'r3',
      'Anna de Wet',
      4,
      'Good water, but the walk in is longer than it looks on the map. Take boots.',
      11
   ),
   review(
      'r4',
      'Johan Pretorius',
      3,
      'Quiet in the middle of the day. Worth it early.',
      25
   ),
];

const STATES = {
   empty: {
      summary: { count: 0, average: null, spread: spread({}) },
      reviews: [],
      yours: null,
      viewer: { signedIn: true, isOwner: false, hasRated: false },
      offset: 0,
      limit: 20,
      hasMore: false,
      nextOffset: 0,
   },
   rated: {
      summary: { count: 4, average: 4, spread: spread({ 3: 1, 4: 2, 5: 1 }) },
      reviews: REVIEWS,
      yours: null,
      viewer: { signedIn: true, isOwner: false, hasRated: false },
      offset: 0,
      limit: 20,
      hasMore: false,
      nextOffset: 4,
   },
   mine: {
      summary: {
         count: 5,
         average: 4.2,
         spread: spread({ 3: 1, 4: 2, 5: 2 }),
      },
      reviews: REVIEWS,
      yours: review(
         'rme',
         'Owen',
         5,
         'My pick of the west coast. Go on the last two hours of the push.',
         1
      ),
      viewer: { signedIn: true, isOwner: false, hasRated: true },
      offset: 0,
      limit: 20,
      hasMore: false,
      nextOffset: 4,
   },
   owner: {
      summary: { count: 4, average: 4, spread: spread({ 3: 1, 4: 2, 5: 1 }) },
      reviews: REVIEWS,
      yours: null,
      viewer: { signedIn: true, isOwner: true, hasRated: false },
      offset: 0,
      limit: 20,
      hasMore: false,
      nextOffset: 4,
   },
};

async function serve(page, getState) {
   await page.route('**/api/sites/*/reviews**', async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === 'GET') {
         return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getState()),
         });
      }

      if (method === 'PUT') {
         const sent = JSON.parse(request.postData() || '{}');
         const state = getState();
         const mine = {
            ...review('rme', 'Owen', sent.rating, sent.body ?? '', 0),
         };
         const count = state.summary.count + (state.yours ? 0 : 1);
         return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
               review: mine,
               summary: {
                  count,
                  average:
                     Math.round(
                        (((state.summary.average ?? 0) * (count - 1) +
                           sent.rating) /
                           count) *
                           10
                     ) / 10,
                  spread: state.summary.spread,
               },
            }),
         });
      }

      return route.fulfill({
         status: 200,
         contentType: 'application/json',
         body: JSON.stringify({
            removed: true,
            summary: STATES.rated.summary,
         }),
      });
   });
}

/* The block's own top, 24px clear of the top of the window. */
const toBlock = async (page) => {
   await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h2')].find((h) =>
         /What anglers make of it/.test(h.textContent)
      );
      if (!heading) return;
      const top = heading.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - 24));
   });
   await page.waitForTimeout(400);
};

const measure = (page) =>
   page.evaluate(() => {
      const box = (el) => {
         if (!el) return null;
         const r = el.getBoundingClientRect();
         return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      const cells = [...document.querySelectorAll('[role=radio]')].map(box);
      const area = document.querySelector('textarea');
      return {
         scrollWidth: document.documentElement.scrollWidth,
         innerWidth: window.innerWidth,
         cells,
         textareaFontSize: area ? getComputedStyle(area).fontSize : null,
         textareaHeight: area
            ? Math.round(area.getBoundingClientRect().height)
            : null,
         headings: [...document.querySelectorAll('h2')].map((h) =>
            h.textContent.trim()
         ),
      };
   });

async function run(viewport, tag) {
   const browser = await launch();
   const ctx = await context(browser, viewport);
   const page = await ctx.newPage();

   await signIn(page);

   let state = STATES.empty;
   await serve(page, () => state);

   for (const name of ['empty', 'rated', 'mine', 'owner']) {
      state = STATES[name];
      await open(page, `/sites/${SITE}`, 1800);
      const heading = page.getByRole('heading', {
         name: 'What anglers make of it',
      });
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await toBlock(page);
      await page.screenshot({
         path: `${OUT}/${tag}-${name}.png`,
         clip: { x: 0, y: 0, ...viewport },
      });
      await page.evaluate((h) => window.scrollBy(0, h - 120), viewport.height);
      await page.waitForTimeout(400);
      await page.screenshot({
         path: `${OUT}/${tag}-${name}-2.png`,
         clip: { x: 0, y: 0, ...viewport },
      });
      const m = await measure(page);
      console.log(`${tag} ${name} ${JSON.stringify(m)}`);
   }

   /*
    * The composer, driven: pick a figure, write something, post it, and see
    * what the block turns into. The PUT is answered here, not on the API.
    */
   state = STATES.empty;
   await open(page, `/sites/${SITE}`, 1800);
   await page
      .getByRole('heading', { name: 'What anglers make of it' })
      .scrollIntoViewIfNeeded();
   await page.getByRole('radio', { name: /^4 out of 5/ }).click();
   await page.waitForTimeout(250);
   await toBlock(page);
   await page.screenshot({
      path: `${OUT}/${tag}-picked.png`,
      clip: { x: 0, y: 0, ...viewport },
   });
   await page
      .locator('textarea')
      .fill('Shallow and clean on the push. Watch the second gate, it floods.');
   await page.getByRole('button', { name: 'Post my rating' }).click();
   await page.waitForTimeout(1200);
   await toBlock(page);
   await page.screenshot({
      path: `${OUT}/${tag}-posted.png`,
      clip: { x: 0, y: 0, ...viewport },
   });
   console.log(`${tag} posted ${JSON.stringify(await measure(page))}`);

   await ctx.close();
   await browser.close();
}

const viewport =
   process.env.W === '1440'
      ? { width: 1440, height: 1000 }
      : { width: 390, height: 844 };
await run(viewport, process.env.W === '1440' ? 'desk' : 'phone');
