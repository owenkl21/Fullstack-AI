import { launch, context, open, signIn, shot, PHONE, DESK } from './lib.mjs';

/*
 * Can the pin be moved, and does a photograph's own position move it?
 * On a phone (touch, through CDP so it is a real finger drag) and a desktop
 * (mouse). Prints the receipt line before and after each gesture.
 *   PHOTO=/path/to/geotagged.jpg node pintest.mjs
 */
const TAG = process.env.TAG || 'live';
const PHOTO = process.env.PHOTO;
const ROUTE = process.env.ROUTE || '/log';

const receipt = (p) =>
   p.evaluate(() => {
      const lines = [...document.querySelectorAll('span, p')].map((e) => e.textContent?.trim() ?? '');
      return (
         lines.find((t) => /^(Phone fix|From the photograph|Pinned by you|Getting a fix|No position)/.test(t)) ?? null
      );
   });

const b = await launch();
for (const [name, vp, touch] of [['phone', PHONE, true], ['desk', DESK, false]]) {
   const ctx = await context(b, vp, { hasTouch: touch, isMobile: touch });
   const p = await ctx.newPage();
   const errors = [];
   p.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
   await signIn(p);
   await open(p, ROUTE, 4500);
   console.log(name, 'start      ', await receipt(p));

   const move = p.getByRole('button', { name: /move the pin/i });
   if (await move.count()) {
      await move.first().click();
      await p.waitForTimeout(2500);
   }
   const map = p.locator('.leaflet-container').first();
   if (!(await map.count())) {
      console.log(name, 'NO MAP on screen');
   } else {
      await map.scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      const box = await map.boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const pinInfo = await p.evaluate(() => {
         const c = document.querySelector('.leaflet-container');
         const markers = c.querySelectorAll('.leaflet-marker-icon').length;
         const overlay = [...c.parentElement.querySelectorAll('[class*="pointer-events-none"]')].length;
         return { markers, overlay, touchAction: getComputedStyle(c).touchAction, dragging: c.classList.contains('leaflet-touch-drag') || c.classList.contains('leaflet-grab') };
      });
      console.log(name, 'pin info   ', JSON.stringify(pinInfo));
      await shot(p, `${TAG}-${name}-pin-0`, { x: 0, y: 0, ...vp });

      const drag = async (fromX, fromY, dx, dy) => {
         if (touch) {
            const cdp = await ctx.newCDPSession(p);
            const pt = (x, y) => [{ x, y, id: 1 }];
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(fromX, fromY) });
            for (let i = 1; i <= 8; i++) {
               await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(fromX + (dx * i) / 8, fromY + (dy * i) / 8) });
               await p.waitForTimeout(30);
            }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
         } else {
            await p.mouse.move(fromX, fromY);
            await p.mouse.down();
            await p.mouse.move(fromX + dx, fromY + dy, { steps: 8 });
            await p.mouse.up();
         }
         await p.waitForTimeout(1500);
      };

      await drag(cx, cy - 10, 70, 40);
      console.log(name, 'drag on pin', await receipt(p));
      await drag(box.x + 40, box.y + box.height - 40, -60, -50);
      console.log(name, 'drag on map', await receipt(p));
      await shot(p, `${TAG}-${name}-pin-1`, { x: 0, y: 0, ...vp });
   }

   if (PHOTO) {
      await open(p, ROUTE, 4500);
      const input = p.locator('input[type=file]').first();
      await input.setInputFiles(PHOTO);
      await p.waitForTimeout(5000);
      console.log(name, 'after photo', await receipt(p));
      const mapShown = await p.locator('.leaflet-container').count();
      console.log(name, 'map visible after photo', mapShown > 0);
      await p.evaluate(() => window.scrollTo(0, 0));
      await shot(p, `${TAG}-${name}-photo`);
   }
   if (errors.length) console.log(name, 'page errors', JSON.stringify(errors.slice(0, 5)));
   await ctx.close();
}
await b.close();
