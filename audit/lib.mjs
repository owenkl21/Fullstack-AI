import { chromium } from 'playwright';

/*
 * Shared pieces for the audit scripts. The full chromium build is blocked on
 * this Windows machine ("Permission denied" on chrome.exe), so no `channel`:
 * Playwright then drives chrome-headless-shell, which runs.
 *
 * HOST picks the site: the live deploy by default, or a local dev server with
 * HOST=http://localhost:5173. OUT is where screenshots land.
 */
export const HOST = process.env.HOST || 'https://fishlogger-client.vercel.app';
export const OUT = process.env.OUT || new URL('./shots/', import.meta.url).pathname;

export const DESK = { width: 1440, height: 1000 };
export const PHONE = { width: 390, height: 844 };

const UA =
   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export async function launch() {
   return chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
}

export async function context(browser, viewport, extra = {}) {
   const ctx = await browser.newContext({
      viewport,
      userAgent: UA,
      deviceScaleFactor: 1,
      permissions: ['geolocation'],
      geolocation: { latitude: -34.13, longitude: 18.33 },
      ...extra,
   });
   /* THEME=night checks the night theme; the app reads 'day' | 'night'. */
   if (process.env.THEME) {
      await ctx.addInitScript((t) => localStorage.setItem('theme', t), process.env.THEME);
   }
   return ctx;
}

/* Vercel's bot check on the live deploy. Never seen locally. */
export async function passChallenge(page) {
   for (let i = 0; i < 10; i++) {
      if (!/Security Checkpoint/.test(await page.title())) return;
      await page.waitForTimeout(1500);
   }
}

export async function open(page, path, settle = 3000) {
   await page.goto(HOST + path, { waitUntil: 'load', timeout: 60000 });
   await passChallenge(page);
   await page.waitForTimeout(settle);
}

/* The test angler the earlier audit scripts (verify15, verify16) sign in as. */
export async function signIn(page) {
   await open(page, '/sign-in', 1500);
   await page.fill('input[type=email]', 'owen@fishlogger.app');
   await page.fill('input[type=password]', 'TestAngler2026!');
   await page.click('button[type=submit]');
   await page.waitForTimeout(3500);
}

/* A clipped shot from the top of the page, or the whole page. */
export async function shot(page, name, clip) {
   const path = `${OUT}/${name}.png`;
   if (clip) await page.screenshot({ path, clip });
   else await page.screenshot({ path, fullPage: true });
   return path;
}

/*
 * Viewport-sized shots down the page, a screen at a time with a little
 * overlap. A full-page shot resizes the viewport to the document, which puts
 * every sticky bar in the wrong place and hides any inner scroll region, so
 * it is no use for judging a form.
 */
export async function scrollShots(page, tag, max = 8) {
   const vh = page.viewportSize().height;
   const total = await page.evaluate(() => document.documentElement.scrollHeight);
   const files = [];
   for (let i = 0, y = 0; i < max && y < total; i++, y += Math.round(vh * 0.88)) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(500);
      files.push(await shot(page, `${tag}-${i}`, { x: 0, y: 0, ...page.viewportSize() }));
   }
   await page.evaluate(() => window.scrollTo(0, 0));
   return files;
}

export const rect = (el) => {
   if (!el) return null;
   const q = el.getBoundingClientRect();
   return {
      top: Math.round(q.top),
      bottom: Math.round(q.bottom),
      left: Math.round(q.left),
      right: Math.round(q.right),
      w: Math.round(q.width),
      h: Math.round(q.height),
   };
};
