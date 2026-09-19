import { readFileSync } from 'node:fs';
import { launch, context, open, signIn, shot, HOST } from './lib.mjs';

/*
 * The log, frame by frame.
 *
 * Every state the review draws for Log a catch (1a to 1h), shot from the
 * running app at the frame's own width and written to
 * audit/shots/built-<id>.png so a capture can be put beside its frame.
 *
 * The frames show the whole sheet at once, footer included, so the viewport
 * is made tall enough to hold the form rather than shooting it in pieces: a
 * full-page shot resizes the viewport to the document and puts every sticky
 * bar in the wrong place.
 *
 * The sign-in happens once and the session is carried into every context
 * after it: the API rate-limits sign-ins, and a run that signs in four times
 * is a run that fails on the fourth.
 *
 *   HOST=http://localhost:5199 node audit/frames-log.mjs
 *   HOST=... ONLY=1d,1h node audit/frames-log.mjs     one or two of them
 */
const PHOTO = new URL('./vaal-gps.jpg', import.meta.url).pathname;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !ONLY || ONLY.includes(id);

const PHONE_TALL = { width: 390, height: 1700 };
const DESK_TALL = { width: 1440, height: 1900 };
/* A believable fix, so the line under the map reads as it does on a phone. */
const FIX = {
   geolocation: { latitude: -34.13, longitude: 18.33, accuracy: 12 },
};

const photoInput = (p) =>
   p.locator('input[aria-label="Choose a photo"]').first();

/*
 * The bucket's CORS list carries the production origin and localhost:5173;
 * the client dev server for this review runs on 5199, so the browser's
 * preflight on the presigned PUT is refused and no photograph can go up.
 *
 * The app's own upload still runs: the PUT is caught here and made from
 * Node, which has no CORS gate, so the bytes land in the bucket for real and
 * the read URL the namer is handed is a picture that exists. Nothing about
 * the page changes; only the browser's origin check is stepped around. Put
 * http://localhost:5199 on the bucket's CORS list and this can go.
 *
 * The bytes come off disk rather than out of the caught request: Playwright
 * does not hand a binary PUT's body to a route, and an empty object in the
 * bucket is a picture the namer cannot read.
 */
async function passUploads(p) {
   const bytes = readFileSync(PHOTO);
   await p.route(/cloudflarestorage\.com/, async (route) => {
      const request = route.request();
      if (request.method() !== 'PUT') return route.continue();
      try {
         const sent = await fetch(request.url(), {
            method: 'PUT',
            body: bytes,
            headers: {
               'content-type':
                  request.headers()['content-type'] || 'image/jpeg',
            },
         });
         await route.fulfill({ status: sent.status, body: '' });
      } catch {
         await route.fulfill({ status: 500, body: '' });
      }
   });
}

/*
 * The fish namer, when the fish namer is up.
 *
 * The hub that names a fish answers 502 from this machine, and 1c, 1f, 1g
 * and 1h all draw the band with its two names in. So the real call is made
 * first and used whenever it answers with names; only when it does not does
 * a stand-in answer take its place, and the run says out loud that it did.
 * The component under it is the app's own either way.
 */
let namerStood = false;
async function nameTheFish(p) {
   await p.route('**/api/vision/identify', async (route) => {
      const live = await route.fetch().catch(() => null);
      if (live && live.ok()) {
         const body = await live.json().catch(() => null);
         if (body?.candidates?.length) return route.fulfill({ response: live });
      }
      namerStood = true;
      await route.fulfill({
         status: 200,
         contentType: 'application/json',
         body: JSON.stringify({
            candidates: [
               {
                  id: null,
                  commonName: 'Galjoen',
                  scientificName: 'Dichistius capensis',
                  confidence: 1,
                  guess: 'Dichistius capensis',
               },
               {
                  id: null,
                  commonName: 'Spiny butterfly ray',
                  scientificName: 'Gymnura altavela',
                  confidence: 0.31,
                  guess: 'Gymnura altavela',
               },
            ],
            raw: [],
         }),
      });
   });
}

/* The namer answers in its own time; the band says where it has got to. */
const waitForNamer = async (p, state, ms = 25000) =>
   p
      .waitForSelector(`[data-namer="${state}"]`, { timeout: ms })
      .then(() => true)
      .catch(() => false);

const settle = (p, ms = 1200) => p.waitForTimeout(ms);

/* A running competition this angler is in, for 1f. */
async function competitionId(p) {
   const found = await p.request
      .get(HOST + '/api/competitions?page=1&tab=mine')
      .then((r) => r.json())
      .catch(() => null);
   const list = found?.competitions ?? [];
   const running = list.find((c) => c.youEntered && c.status === 'running');
   return running?.id ?? list[0]?.id ?? null;
}

const b = await launch();
const errs = [];
const done = [];

/*
 * One sign-in, kept. The API answers a burst of sign-ins with 429, so it is
 * tried a few times with a wait between and then handed on as cookies.
 */
let session = null;
{
   const ctx = await context(b, PHONE_TALL, FIX);
   const p = await ctx.newPage();
   for (let i = 0; i < 4 && !session; i++) {
      await signIn(p);
      if (!/sign-in/.test(p.url())) session = await ctx.storageState();
      else await p.waitForTimeout(15000);
   }
   await ctx.close();
}
if (!session) {
   console.log('could not sign in (the API is rate limiting). Nothing shot.');
   await b.close();
   process.exit(1);
}
const signedIn = (size) => context(b, size, { ...FIX, storageState: session });

/* ---- 1a, 1b, 1c, 1d, 1e: the three steps on a phone --------------------- */
if (want('1a') || want('1b') || want('1c') || want('1d') || want('1e')) {
   const ctx = await signedIn(PHONE_TALL);
   const p = await ctx.newPage();
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   await passUploads(p);
   await nameTheFish(p);
   await open(p, '/log', 6000);

   if (want('1a')) {
      await shot(p, 'built-1a');
      done.push('1a');
   }

   await photoInput(p).setInputFiles(PHOTO);
   /* 1b is the band while the namer is still looking, so it is caught on
      the way past rather than waited out. */
   if (want('1b')) {
      const asking = await waitForNamer(p, 'asking', 10000);
      await p.waitForTimeout(700);
      await shot(p, 'built-1b');
      done.push(asking ? '1b' : '1b (no asking band was caught)');
   }

   const named = await waitForNamer(p, 'named');
   await settle(p, 1500);
   if (want('1c')) {
      await shot(p, 'built-1c');
      done.push(named ? '1c' : '1c (the namer offered no names)');
   }

   /* Step 2, with a name taken off the band and a length typed, so the
      card on step 3 has a fish and a figure on it. */
   if (want('1d') || want('1e')) {
      await p
         .getByRole('button', { name: /^Galjoen/ })
         .first()
         .click()
         .catch(() => undefined);
      await settle(p, 900);
      await p
         .getByRole('button', { name: /^Next$/ })
         .first()
         .click();
      await settle(p, 900);
      await p.locator('#length').fill('42');
      await settle(p, 600);
      if (want('1d')) {
         await shot(p, 'built-1d');
         done.push('1d');
      }
      if (want('1e')) {
         await p
            .getByRole('button', { name: /^Next$/ })
            .first()
            .click();
         await settle(p, 1400);
         await shot(p, 'built-1e');
         done.push('1e');
      }
   }
   await ctx.close();
}

/* ---- 1f: step 1 opened from a competition ------------------------------ */
if (want('1f')) {
   const ctx = await signedIn(PHONE_TALL);
   const p = await ctx.newPage();
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   await passUploads(p);
   await nameTheFish(p);
   const id = await competitionId(p);
   if (!id) {
      done.push('1f SKIPPED: the test angler is in no competition');
   } else {
      await open(p, `/log?competition=${id}`, 6000);
      await photoInput(p).setInputFiles(PHOTO);
      await waitForNamer(p, 'named');
      await settle(p, 1500);
      await shot(p, 'built-1f');
      done.push('1f');
   }
   await ctx.close();
}

/* ---- 1g: the same sheet at night --------------------------------------- */
if (want('1g')) {
   const ctx = await signedIn(PHONE_TALL);
   await ctx.addInitScript(() => localStorage.setItem('theme', 'night'));
   const p = await ctx.newPage();
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   await passUploads(p);
   await nameTheFish(p);
   await open(p, '/log', 6000);
   await photoInput(p).setInputFiles(PHOTO);
   await waitForNamer(p, 'named');
   await settle(p, 1500);
   await shot(p, 'built-1g');
   done.push('1g');
   await ctx.close();
}

/* ---- 1h: the one card, 1440 -------------------------------------------- */
if (want('1h')) {
   const ctx = await signedIn(DESK_TALL);
   const p = await ctx.newPage();
   p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
   await passUploads(p);
   await nameTheFish(p);
   await open(p, '/log', 6000);
   await photoInput(p).setInputFiles(PHOTO);
   await waitForNamer(p, 'named');
   await settle(p, 1800);
   await shot(p, 'built-1h');
   done.push('1h');
   await ctx.close();
}

await b.close();
console.log('captured:', done.join(', ') || 'nothing');
if (namerStood) {
   console.log(
      'NOTE: the fish namer did not answer, so the two names in the band are a stand-in.'
   );
}
console.log('page errors:', errs.length ? errs : 'none');
