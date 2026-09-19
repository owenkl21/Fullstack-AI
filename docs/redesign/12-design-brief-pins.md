# Brief for Claude Design: map pins and marks for fishlogger

Paste everything below this line into Claude Design.

---

You are designing a set of map pins and small marks for **fishlogger**, a
South African rock-and-surf fishing log. Anglers log a catch with a photo, a
species, a length, and the conditions at that hour (wind, pressure, swell,
water temperature, moon), and they keep a map of spots. The map is satellite
imagery of the Cape and KZN coast: dark blue sea, green and brown veld, pale
sand, grey rock ledges. Everything you draw will sit on top of that.

## The look, which is fixed

Do not propose a palette, a typeface or a radius. These are decided.

- Display face: **League Gothic**, uppercase, tracked slightly. Body: **Jost**.
- Colours: teal `#34ADBD` (accent), ink `#0B0909` (near black), paper
  `#F4F1EC` (off white), ink-3 `#7E7873` (quiet grey). Teal on ink or teal on
  paper only; never teal text on a photograph.
- **Border radius is 0 everywhere in the product.** A pin may be round or a
  pennant, because those are shapes, not corners on a card.
- No gradients, no glows, no drop shadows on flat UI. On the map a pin needs a
  shadow to lift off imagery; keep it short and dark, `0 3px 10px rgba(0,0,0,.55)`.
- Mood: a field notebook, not a gaming HUD. Think tide tables and survey sheets.

## The problem to solve

Pins have to be told apart at a glance **and** stay readable on any patch of
imagery. A teal disc on green water disappears. So:

- Every pin has a **light ring on a dark or saturated body**. That ring is what
  separates it from the picture underneath; it is non-negotiable.
- **Shape carries the kind. Colour reinforces it.** Someone who cannot tell
  teal from grey must still tell a spot from a slipway.
- Pins are drawn as **SVG with CSS-variable colours**, so they take the theme
  at runtime. Deliver clean SVG, `viewBox="0 0 24 24"` for glyphs, stroke
  `2.2`, round caps and joins, no fills inside glyphs.

## The set

Six kinds, three families of shape.

| Kind | Shape | Body | Ring / glyph | Carries |
|---|---|---|---|---|
| Your spot | disc on a stem | teal | dark number | catch count, e.g. **7** |
| Another angler's spot | disc on a stem | ink | paper number | catch count |
| Private mark (waypoint) | **pennant on a pole** | paper flag | ink glyph | a small glyph for its kind |
| Slipway / boat ramp | **square plate on a stem** | blue `#1F6FB2` | paper glyph | |
| Marina / harbour | square plate | navy `#1D3557` | paper glyph | |
| Tackle / bait shop | square plate | amber `#C97B1C` | paper glyph | |
| Parking | square plate | grey `#4A4542` | paper glyph | |

Sizes: disc 40px, plate 32px, pennant flag 28×22 on a 44px pole. The **tip of
the stem is the coordinate**, so every shape needs a clear point.

The number inside a disc is set in League Gothic, ~21px, tabular. Two digits
must fit; "99+" is the cap.

## What I need from you

1. **Glyphs, 24-grid, stroke only**, for: the house fish (below), a pennant,
   a slipway (ramp running into water), an anchor, a hook, a P. Also for
   waypoint kinds: a mark, a way down (steps/path to a ledge), a hazard
   (rocks), parking, bait.
2. **A cluster pin** for when many spots overlap at low zoom: a disc that
   reads as "several", with a count, that is clearly not a single spot.
3. **A "you are here" mark** distinct from every pin above (it is not a place,
   it is a position).
4. **Selected and hover states** for the disc and the plate: a small scale up
   and a ring change is enough. No colour swap that could collide with
   another kind.
5. **A legend strip**: the six kinds in a row, 44px tall, labelled in Jost
   14px, for the bottom of the map.
6. Optionally, **species silhouettes** for the Cape shore: galjoen, kob, elf
   (shad), garrick (leervis), blacktail, bronze bream, white steenbras,
   hottentot, spotted grunter. Side profile, single stroke weight, 24-grid,
   recognisable at 20px. These would sit in the fish filter chips and on
   personal-best rows.

## The house fish, for reference

This is the mark already used across the product. Keep its character.

```svg
<svg viewBox="0 0 68 44" fill="none" stroke="currentColor" stroke-width="2.2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 30c10-14 24-20 40-16 8 2 14 6 24 6-8 6-16 8-24 8-16 0-30-4-40 2Z"/>
  <path d="M44 14c-4-6-10-8-16-8 4 4 8 6 14 6M22 24c4 4 8 4 12 2"/>
</svg>
```

## How to show your work

Mock every pin on three backgrounds: dark blue sea, mid green veld, pale
sand. If any pin is hard to find on any of the three, it is not done. Show
the full set at 100% and at 50% side by side, because on a phone the map is
small and the pins are the size of a fingernail.

Deliver: one SVG per glyph, one SVG per assembled pin, the legend strip as
SVG, and a short note on any decision you took that is not in this brief.
