# Owen's queue, 17 September 2026

Raised in one message during the design pass. Ordered by what hurts most, not by
the order they were said in. Anything marked done has been pushed and checked on
the live deploy.

## Done

- [x] **Blank white page on a route, needs a refresh.** Every route is code
      split and the file names carry a content hash, so a deploy removes the
      hashes an open tab still expects. Nothing caught the rejection. Imports
      retry once, then reload once, then fall to a boundary that says so.
- [x] **Asked for my location every single time.** One shared store, kept in
      localStorage. The prompt is still only raised by a tap, but the answer is
      remembered and a granted permission refreshes silently.
- [x] **Everything we can get in the conditions.** Already had air, feels-like,
      dew point, humidity, pressure, cloud, visibility, wind, gusts, UV, sea
      surface temperature, wave and swell. Added sunrise, sunset and moon phase
      with a spring-tide flag, since no weather API publishes a phase and that is
      what a shore angler plans around.

## Next, in order

1. **Show all of it, with icons.** The readout strip prints three figures out of
    twenty. Condition icons, moon, sun times, sea state.
2. **Feed card rebuild.** Disorganised, no icons on like/comment/follow, no
    placeholder when there is no photograph, no way back to the feed from a
    catch, no way through to the person.
3. **Gear on a log**, chosen from your own gear, with a way to add a new piece
    without leaving the form.
4. **Log everything.** Every condition saved on the catch, water temperature
    included. Pin visibility a toggle: hidden from other anglers, still in the
    data for us.
5. **Back-dated catches.** Drop a pin and a date for a fish logged from home,
    and pull the weather for that place and time. The historical path already
    exists in the Open-Meteo client.
6. **Profile.** Settings panel is the worst-looking screen in the app. Banner
    image and profile picture. Followers and following as real controls with
    counts and icons. More figures: favourite spot, best day, favourite species.
7. **Competitions.** Anglers create their own with their own rules: dates,
    species, length or weight, and the unit follows the reader's setting.
8. **This season strip.** Several fish in one day need a better shape than one
    bar each.
9. **Component library.** The distance toggle and the filters are home made.
    Standardise on one maintained set.
10. **Motion on the torn edges.** A slow flow rather than a static shape.
11. **Saving other people's spots, gear and lures.**
12. **Contours on desktop.** Cut off and repetitive, worst on the home page.
13. **Phone: the Log key** wants an icon and less sharp corners.
14. **Phone: the filters** still take too much room.

## Standing constraints

The font and the theme do not change. No em dashes in anything a reader sees.
Mobile first, desktop deliberate.
