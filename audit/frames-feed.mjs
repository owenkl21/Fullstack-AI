/*
 * The feed card, shot against its frames.
 *
 * Frames 2a to 2e of docs/redesign/design-review-2026-09-19: 2a the feed on a
 * phone by day, 2b the card with its comments open, 2c the common card with no
 * photograph and nothing measured, 2d the same feed at night, 2e the sideways
 * card at 1440. Writes audit/shots/built-2a.png … built-2e.png.
 *
 *    cd audit && HOST=http://localhost:5199 node frames-feed.mjs
 *
 * 2a, 2d and 2e are the page: the plate, the wave and the column under it, shot
 * at the viewport so the head and the bottom bar sit where a reader has them.
 * 2b and 2c are one card each, the way the frames draw them, so the card is
 * found in the live feed rather than assumed to be first: 2b wants a post that
 * has a thread to open, 2c a catch with neither a photograph nor a size. The
 * script says so plainly when the seeded feed has no such post rather than
 * shooting the wrong card.
 */
import { launch, open, shot, HOST } from './lib.mjs';

const PHONE = { width: 390, height: 1400 };
const DESK = { width: 1440, height: 1400 };

/* Every shot is of the feed as a signed-in angler has it. */
async function phone(browser, theme) {
   const ctx = await browser.newContext({
      viewport: theme === 'desk' ? DESK : PHONE,
      deviceScaleFactor: 1,
      permissions: ['geolocation'],
      geolocation: { latitude: -34.13, longitude: 18.33 },
   });
   if (theme === 'night') {
      await ctx.addInitScript(() => localStorage.setItem('theme', 'night'));
   }
   return ctx;
}

/*
 * The test angler, signed in and waited for rather than slept at. The shared
 * helper gives the form a fixed fifteen hundred milliseconds to arrive and
 * types into it whether it has or not, which on a cold dev server fills a
 * field React has not claimed yet and quietly leaves the run signed out.
 */
async function signInAs(page) {
   await page.goto(`${HOST}/sign-in`, { waitUntil: 'load', timeout: 60000 });
   await page.waitForSelector('input[type=email]', { timeout: 30000 });
   await page.fill('input[type=email]', 'owen@fishlogger.app');
   await page.fill('input[type=password]', 'TestAngler2026!');
   await page.click('button[type=submit]');
   await page.waitForURL((url) => !/\/sign-in/.test(url.pathname), {
      timeout: 30000,
   });
}

/*
 * Signed in, and known to be: the keep word only exists for an angler the
 * server recognises, so a run that quietly stayed signed out would shoot a
 * card with half its row missing and nothing would say so. Three goes, then it
 * reports and carries on rather than pretending.
 */
async function openFeed(page) {
   for (let i = 0; i < 3; i++) {
      try {
         await signInAs(page);
      } catch {
         continue;
      }
      await open(page, '/feed', 5000);
      const on = await page.evaluate(() =>
         Boolean(
            document.querySelector(
               'article.blk button[aria-label="Keep"], article.blk button[aria-label="Kept"]'
            )
         )
      );
      if (on) return true;
   }
   console.log('          WARNING: still signed out, the shots will show it');
   return false;
}

/* Scroll so the whole of an element is on screen, clear of the sticky head. */
async function bring(page, handle, lead = 96) {
   await handle.evaluate((el, lead) => {
      const y = window.scrollY + el.getBoundingClientRect().top - lead;
      window.scrollTo(0, Math.max(0, y));
   }, lead);
   await page.waitForTimeout(1000);
}

/*
 * One card, cut out of the page with the paper margin the frames give it.
 *
 * It aims twice and checks before it fires. Cards carry `content-visibility`,
 * so a card the reader has not reached stands in at a guessed height until it
 * is drawn: scrolling to a card fifty posts down settles the guesses above it
 * and the whole column slides while you are looking at it. The shot is taken
 * only once the card has stopped moving, or the run says so.
 */
async function shotCard(page, name, handle, lead = 96) {
   let box = null;
   for (let i = 0; i < 6; i++) {
      await bring(page, handle, lead);
      const settled = await handle.boundingBox();
      if (
         box &&
         Math.abs(settled.y - box.y) < 2 &&
         Math.abs(settled.height - box.height) < 2
      ) {
         box = settled;
         break;
      }
      box = settled;
   }
   await shot(page, name, {
      x: Math.max(0, box.x - 16),
      y: Math.max(0, box.y - 16),
      width: box.width + 32,
      height: box.height + 32,
   });
   return handle.evaluate((el) => el.querySelector('h2')?.textContent ?? '');
}

/**
 * Which card in the column is the one a frame draws.
 *
 * `thread` is a post with comments on it, so opening the thread shows the
 * thread rather than "No comments yet"; `plain` is a catch with no photograph
 * and no size, which is 2c. Both read the card as the reader sees it: a photo
 * frame with no `img` in it never had a photograph, and a heading with no
 * figures under it was never measured.
 */
async function findCard(page, kind) {
   return page.evaluate((kind) => {
      const cards = [...document.querySelectorAll('article.blk')];
      const hasPhoto = (a) =>
         Boolean(a.querySelector('div[class*="aspect-"] img'));
      const hasSize = (a) => Boolean(a.querySelector('h2 + p span.num'));
      const comments = (a) => {
         const button = a.querySelector('button[aria-label="Comments"]');
         return Number(button?.textContent?.trim() ?? 0);
      };

      if (kind === 'thread') {
         return cards.findIndex((a) => comments(a) > 0);
      }
      /* 2c is the quiet card: no photograph, no size, and no thread hanging
         off it either, so the row reads 0 and 0 the way the frame draws it. */
      return cards.findIndex(
         (a) => !hasPhoto(a) && !hasSize(a) && comments(a) === 0
      );
   }, kind);
}

/*
 * The same search, over as much of the feed as it takes. The column pages in
 * twenty five at a time, so a card that is the sixtieth post is not in the DOM
 * until the page has been scrolled far enough to ask for it.
 */
async function findCardDeep(page, kind, pages = 4) {
   for (let i = 0; i <= pages; i++) {
      const at = await findCard(page, kind);
      if (at >= 0) return at;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
   }
   return -1;
}

const browser = await launch();

/* ---- 2a, 2b, 2c: the phone, by day ---------------------------------------- */
{
   const ctx = await phone(browser, 'day');
   const page = await ctx.newPage();
   await openFeed(page);

   await shot(page, 'built-2a', { x: 0, y: 0, ...PHONE });
   console.log('built-2a  the feed, phone, day');

   /* 2b: the thread, open, inside the card. */
   const threadAt = await findCard(page, 'thread');
   if (threadAt < 0) {
      console.log(
         'built-2b  SKIPPED: no post in the live feed has a comment on it'
      );
   } else {
      const card = page.locator('article.blk').nth(threadAt);
      await bring(page, card);
      await card.locator('button[aria-label="Comments"]').click();
      await page.waitForTimeout(700);
      const on = await shotCard(page, 'built-2b', card);
      console.log(`built-2b  card ${threadAt + 1} (${on}), comments open`);
      await card.locator('button[aria-label="Comments"]').click();
      await page.waitForTimeout(400);
   }

   /* 2c: no photograph, nothing measured. */
   const plainAt = await findCardDeep(page, 'plain');
   if (plainAt < 0) {
      console.log(
         'built-2c  SKIPPED: every post on this page has a photograph or a size'
      );
   } else {
      const card = page.locator('article.blk').nth(plainAt);
      const on = await shotCard(page, 'built-2c', card);
      console.log(
         `built-2c  card ${plainAt + 1} (${on}), no photograph, not measured`
      );
   }

   await ctx.close();
}

/* ---- 2d: the phone, at night ---------------------------------------------- */
{
   const ctx = await phone(browser, 'night');
   const page = await ctx.newPage();
   await openFeed(page);
   await shot(page, 'built-2d', { x: 0, y: 0, ...PHONE });
   console.log('built-2d  the feed, phone, night');
   await ctx.close();
}

/* ---- 2e: desktop 1440 ------------------------------------------------------ */
{
   const ctx = await phone(browser, 'desk');
   const page = await ctx.newPage();
   await openFeed(page);
   await shot(page, 'built-2e', { x: 0, y: 0, ...DESK });
   console.log('built-2e  the feed, desktop 1440');
   await ctx.close();
}

await browser.close();
