# The audit

`audit.mjs` drives a real browser over the deployed site, signed in and out, at
phone and desktop width, and reports what it finds. Run it after any change that
touches layout.

```bash
cd /tmp && mkdir -p fl-audit && cd fl-audit
npm init -y && npm i playwright && npx playwright install chromium
node /path/to/docs/redesign/audit.mjs
```

It checks every route for horizontal scroll, broken images, console errors, a
missing `h1`, inputs under 16px (which make iOS zoom), and tap targets under the
brief's 44px minimum. Screenshots land in `/tmp/fl-audit/shots`.

## What it deliberately does not report

Four patterns look like failures to a naive measurement and are not. Each was
checked against the live page before being excluded, rather than assumed:

- **Stretched links.** A row whose link carries `after:absolute after:inset-0`
  is clickable across the whole row. `getBoundingClientRect` on the anchor sees
  only the text, so the catch rows measured 21px and are really 77px.
- **A radio or checkbox inside a label.** The label is the target. The spot
  pickers on the log form measure 20px at the control and 48px at the label.
- **A link inside running prose.** "Longest so far, *that catch* at 72 cm" is a
  sentence, not a control. Forcing it to 44px blows a gap through the paragraph
  for no usability gain.
- **Licence attribution.** OpenStreetMap and OpenSeaMap attribution is fine
  print by nature, and it is a licence condition rather than a control.

The `sr-only` skip link and hidden file inputs are excluded for the same reason:
they are invisible on purpose.

## What it has caught

The first run found fifteen high and thirty medium. The worst was a teal focus
ring painted around the heading of every page: `AppLayout` moves focus to the
`h1` on navigation for screen readers, and when route splitting landed that
focus started happening after mount, where the browser paints it.

It also caught every seeded photograph being broken, because the image resolvers
presigned local files against R2; the OpenSeaMap overlay requesting tiles below
zoom 9, which do not exist; a hero scrim that fell to five per cent opacity
exactly where the headline sits; and the boards page scrolling sideways on a
phone because an `overflow-x-auto` container could not clip, being a grid child
with the default `min-width: auto`.
