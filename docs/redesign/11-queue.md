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

- [x] **Show all of it, with icons.** Water, swell, sea state, moon with the lit
      fraction drawn from the real phase, first and last light, humidity, sky.
      Pressure had been fetched and then dropped on the way to the screen, so
      its readout always said "Not reported"; it reads 1035 hPa now.
- [x] **Gear on a log without leaving it.** Three fields, saves, joins the list
      and ticks itself. Checked live: 201, and the piece comes back ticked.
- [x] **Back goes where you came from**, rather than always to My catches.
- [x] **Marks on the feed controls**, with the counts on the controls they
      belong to, and a card that keeps its shape when there is no photograph.
- [x] **Railway was never auto-deploying.** Every deployment in the project's
      history was triggered by hand from a laptop and the repository has no
      webhooks, so the server had been three hours behind the client. A CI
      workflow now deploys it and fails if the server does not answer.

- [x] **Anglers have a profile other people can open.** New public endpoint and
      an /anglers/:id route, with follow from it. The public view is its own
      query, not the owner's with a flag: the owner's selects an email address
      and every catch regardless of visibility, and only PUBLIC records appear
      here. Checked on the live payload: no email field, correct keys only.
- [x] **Followers and following are controls**, with the figure leading and a
      mark on each, on both profiles.
- [x] **Favourite species, favourite spot, best day.** Counted over the catches
      already loaded. The site had never been selected for the stats, so a
      favourite spot could not have been worked out before. Each stays null
      until it has happened more than once.

## Next, in order

1. **The rest of the feed card.** Still disorganised: the ordering of heading,
    species, measurement and meta has not been reworked.
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
