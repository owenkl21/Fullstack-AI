# The final design system

One system for the fishing log redesign. Base direction, every judge violation fixed, grafts named, tokens computed.

---

## 0. Decision log

### 0.1 Which direction is the base, and why

The judges tied at six points. Every direction failed at least one lens, so the test is not "who won". The test set for me was: **after every violation from all three judges is fixed, which direction still means what its identity sentence said it meant, and which one had to be rebuilt to get there.** Direction by direction.

**Stamp First does not survive its own fixes.** Its identity is a press: "a press that stamps a record before it asks a question". Three separate judges take the press away. The slop hunter: "the hold gesture (a tap plus the same readout does the identical job without asking a wet hand to hold capacitive contact)". The field judge: "a wet capacitive screen breaks holds" and "never acknowledges that its own field condition attacks its own input gesture". The craft judge: "THE SIGNATURE IS A TIMED HOLD WITH NO ALTERNATIVE... no keyboard behaviour on the desktop rail". Remove the hold and the name, the premise, the wordmark ("the rule is the ink line of the press") and the one ownable component all stop describing anything. On top of that the accent has to move, because it is the banned outdoor orange and because "`--primary` AND `--destructive` ARE THE SAME COLOUR. I computed primary against destructive: 1.40:1 light, 1.10:1 dark", and the data model has to move, because section 9 abolishes estimates while sections 9 and 12 both print "Weight estimated." The craft judge's summary is correct and I am adopting it: "together they mean the palette, the primary gesture and the data model all have to be re-decided, which is a different direction rather than a revision."

**Spec Block loses both halves of its identity sentence.** The sentence is "every value on screen carries its unit, its conversion and its provenance on the same line, and the only saturated colour anywhere on a record is the short segment of a measure line that runs past the angler's own best." Half one is contradicted by its own section 9, which sets the unit at 13px condensed muted while the value is 19 or 28px foreground, and the craft judge measured the drop: "a 2.15x size drop and a drop from 17.90:1 to 6.82:1 on the exact half of the string the identity says is inseparable". Half two is the measure line, and all three judges kill it: the slop hunter calls it "a bar chart with a threshold marker, the single most default object for 'compare a value against a reference'"; the craft judge measured the boundary that actually carries it and found "2.46:1 light, 2.39:1 dark", below 3:1 in both themes; and it is "absent for a new angler and grey for an old one". Fixing both halves rewrites the identity sentence, the type scale and the entire light palette, which invalidates seventeen published ratios. The system underneath is the most enforceable of the three, which is why more of it is grafted here than from anywhere else, but it is a system, not an identity.

**Weigh Slip keeps its identity, and only one thing inside it has to be rebuilt.** Its sentence is "every number on screen carries a visible mark of how it was obtained". Every judge attacks the *carrier* and none of them attacks the *claim*. The slop hunter: "The signature is a code that has to be taught, on the surface where taught codes fail." The field judge: "Solid versus dashed at 2px, at arm's length, in noon glare, through polarised sunglasses, in a list row at Plex Mono 400, is marginal." The craft judge: "THE DASHED STATE IS NOT SPECIFIABLE AS WRITTEN." Three attacks on one line, zero attacks on the sentence. Everything else on its list is a parameter: a token that clips, a ratio nobody computed, a cap broken by one number, an icon ban broken in three components, a validation gate that should have had a default, a nav slot in the wrong corner, two input bugs it forgot to name. Those are an afternoon each. So the base is Weigh Slip, and the one structural job is to replace a typographic code with something that survives a wet screen in glare.

**What replaced the code.** A solid line under a weight and a dashed line under a weight are two marks that mean different things and look nearly the same. The plainer alternative that a mark cannot beat is the word. `4.2 kg (9 lb 4 oz) by eye` needs no legend, survives glare, survives polarised lenses, survives a colour-blind reader, survives a screen reader, and costs a reader who has never seen the app nothing, because `4.2 kg` read plainly still means 4.2 kg. That is the signature now, and it is stated as a rule in section 11.

### 0.2 Every violation and every biggest gap raised against Weigh Slip, and what changed

#### Slop hunter

> **Biggest gap: "Remove the confidence rule and nothing remains that the other two directions do not also have. Its identity sentence, 'the catch record is the product', is the shared premise of all three rather than a distinguishing one."**

Changed. The premise is no longer "the record is the product", which is indeed what all three said. The premise is narrower and falsifiable: **this product will not render a number without saying where the number came from, and it will not encode that in anything but words.** That produces things the other two directions cannot produce: no legend anywhere in the product, no reliability badge, no confidence colour, no measure bar, a species field that says `species not recorded` rather than staying blank, a conditions block that prints its own distance and lag, a position that prints `placed by hand` in the string rather than inside a punctuation convention, and a landing page whose entire argument is one record reading its own provenance out loud. It also produces a refusal the other two could not have made: the second family is gone, because a mono face exists to carry a code and this system has no codes.

> **"The signature is a code that has to be taught, on the surface where taught codes fail. A 2px versus a 2-on-3 dashed underline, distinguished by nothing else, read at arm's length in glare on a wet phone... Every record page then carries a legend, which is chrome the direction claims to have removed."**

Fixed by removal. There is no confidence rule, no legend line, and no `Solid rule: measured. Broken rule: your estimate.` string in the product. Provenance is a word in the value's own string (section 11). The word is the same size as the value, in `--muted-foreground`, measured at 7.28:1 light and 6.12:1 dark on a record.

> **"The dashed state reintroduces a tell the same document bans. Section 14 lists 'The dashed dropzone that does not accept drops' among the removals, and section 11 makes a dashed line the product's only carrier of measurement reliability."**

Fixed. There is not one dashed border in this system, in any state, on any component. It is a token-level ban (section 6).

> **"The second typeface may be redundant against the first, and the document says so... If Atkinson has tabular figures, the alignment job is gone and IBM Plex Mono is carried for a slashed zero on coordinates that appear in two places."**

Fixed, and I checked the two claims rather than assuming either. Tabular figures: verified at source in `sources/AtkinsonHyperlegibleNext.glyphs` in `googlefonts/atkinson-hyperlegible-next`, which defines `feature tnum` substituting `zero` through `nine` to `.tf` tabular variants. The alignment job is therefore gone. Slashed zero: the family ships no `zero.slash`, no `zero.dotted` and no stylistic set for one, so a slashed zero is not available, and checking why it was wanted retired the argument entirely. A coordinate in this product is `-34.13291, 18.43056`, which contains digits, a minus, a comma and a full stop and no letters at all, so there is no `O` for a `0` to be confused with. Both mono jobs are gone, so the second family is gone. One family ships.

> **"The fast path adds a required decision at the moment the document says decisions are fatal... 'Neither state is preselected; the field is incomplete until one is chosen.' Both measurement fields in the five-control fast path now demand a second tap before they validate."**

Fixed. A measurement typed with nothing else touched is recorded `by eye`, which is the weaker claim, and the record prints it. Save is never blocked by it. Tapping `On a scale` or `On a tape` beside the field upgrades it. The default can be flipped per angler in one profile switch for weight and for length independently, because a bank angler with a scale in the bag should not tap twice every time. This is the IGFA mechanism applied to a default rather than to a rounding: when in doubt the record understates the claim.

> **"The steal list claims a discipline the scale does not keep: 'Two text sizes for the whole product; a six-step spacing scale short enough that nobody invents a seventh'. Section 4 then ships seven type tokens at 14/16/19/23/23/28/40."**

Fixed by dropping the claim and shrinking the scale. The steal from Arc'teryx is now stated as what it is, a six-step spacing scale, and the type scale ships six tokens of which two are the same role at two breakpoints (section 4). The product has one body size, 16px.

> **"The landing page is the three-card feature row with the cards removed... Three of the same thing answering three questions is the same reflex. The FAQ repeats it with exactly three questions."**

Fixed. The landing page has four bands and the questions list has five questions (section 12). The prose block answering "what it stores, who can see it, what it costs" is gone; those answers moved into the questions list where they belong.

> **"Tricolon in the identity sentence: 'every other screen is only a way of making, finding or sharing one of those slips'."**

Fixed. The new identity sentence has two clauses and no list (section 1). Every headline, sub, error and empty string in section 13 was written and then checked for three-part lists.

> **"An unmeasured number stated as a spec: 'Accent coverage on any screen is under 5% of pixels.' The document's authority rests on computed values; this one is asserted."**

Fixed by deletion. There is no pixel-coverage claim anywhere in this document. The accent rule is an enumeration of the places it may appear, which is auditable by grep, rather than a percentage nobody measured.

> **"`--r-field | 6px` sits inside the shadcn radius family it removes."**

Fixed. `--r-control` is 4px, with the reason stated: at 4px the curvature is one whole device pixel at 1 dppx, so "this is pressable" survives the cheapest screen in the audience. 6, 8 and 10px are the shadcn sm, md and default values and none of them is used.

> **"Section 9 retains 'length cm, in, ft' as entry units. Spec Block identifies feet-for-a-fish as the source of a real unit-conversion bug and removes it; this direction keeps the option and calls the missing inches 'a bug, not a decision'."**

Fixed, and I took Spec Block's position. Length entry offers `cm` and `in`. Feet are removed. Weight entry offers `kg`, `lb` and `lb + oz`.

#### Angler in the field

> **Biggest gap: "A blocking validation gate on the fast path... Type 48 into length at 06:40 with a fish out of the water, hit Save, and the form blocks."**

Fixed exactly as this judge proposed. Nothing in the fast path can block a save. The only field that can fail validation anywhere in the product is a field whose value the server will reject outright, and that failure renders beside the field, never in a toast, and never on the fast path, which has no required field at all. A catch can be saved with a time and nothing else.

> **"The primary action sits in the worst thumb position on the bar. 'Five word slots at 16px weight 520: Log, Catches, Spots, Gear, Feed. The Log slot is a filled `--primary` chip.' Log is leftmost, the hardest bottom-bar cell for a right-handed one-handed grip to reach."**

Fixed. `Log` is the **last** slot, it is the only filled control in the bar, it is a block the full height of the bar and about 38% of its width, and the profile carries one switch that mirrors the bar for a left-handed grip. I am not taking the full-width 96px control that this judge preferred in Stamp First, because the same judge measured what it costs: "194px of permanent bottom chrome... 23% of a 390x844 viewport on every screen". The screen an angler looks at most is a photograph of a fish, so the chrome stays at 56px plus the safe-area inset and the trade is stated rather than hidden.

> **"The signature carries the entire argument on a distinction never tested for the stated viewing condition... The direction never scales the rule up on the detail page, where Spec Block does, and never measures it."**

Fixed by removing the distinction from the mark and putting it in the word. There is nothing left to scale or measure, because `by eye` is set at the same size as the value it follows and is measured with every other text pair in section 5.

> **"The step attribute bug is not addressed anywhere. LogCatchPage.tsx:694,719 and EditCatchPage.tsx:447,475 use `step="0.1"`, so typing 2.25 raises the browser's nearest-valid-values bubble and blocks submit."**

Fixed. No numeric input in this product carries a `step` attribute. Every one carries `inputmode="decimal"` and `min="0"`. Negatives are rejected beside the field rather than saved as `-60.96`.

> **"The unit-switch conversion bug is not addressed... EditCatchPage.tsx:450: switching cm to ft on a 45cm fish saves 1371.6cm."**

Fixed, with Spec Block's fix. Tapping the unit chip converts the number already typed. It never reinterprets it. Feet are gone from the option list, which removes the pair that produced the worst version of the bug.

> **"The 14px register is broader than the discipline claims... the catch row sub-line 'Tue 15 Sep, 06:42, Kalk Bay' at 14px muted is precisely what an angler scans a list by in glare."**

Fixed. The row sub-line is 16px. It recedes by colour only, at 6.58:1 light and 6.85:1 dark, which is the mechanism this judge praised in Stamp First ("muted text same size, lower contrast"). 14px has exactly two uses in the whole product and both are read close up at a desk: the Google weather attribution line, and helper or validation text sitting beside a field.

#### Craft and build

> **Biggest gap: "The signature's uniqueness is a sentence, not a system rule. 'The only 2px line in the product' is contradicted by the focus ring, the active nav underline, the upload progress bar and the reduced-motion save border, all specified inside the same document."**

Fixed at the root. The signature is no longer a line, so no line in the product carries meaning that another line could steal. The uniqueness claim is now enforceable by grep because it is a claim about vocabulary: there is no legend string, no reliability badge, no confidence colour and no reliability mark in the codebase.

I am registering one disagreement with this judge's proposed fix. The proposal was: "Fix is cheap (make the confidence rule the only 2px carrier and move focus to 3px, nav to 1px or a fill)". That fix protects a carrier that two other judges independently showed is unreadable in the condition the product is for, so it buys internal consistency at the price of the actual job. Removing the carrier is more expensive and it is the right trade.

> **"SIGNATURE UNIQUENESS CLAIM IS FALSE FIVE TIMES OVER... I computed the nav underline (`--primary`) against the confidence rule (`--foreground`): 2.31:1 light, 2.24:1 dark."**

Fixed. Line weights now map to exactly three jobs and none of them is semantic: 1px `--border` divides content, 1px `--input` bounds anything operable, 2px `--ring` at 2px offset is focus and nothing else. The active nav word is `--foreground` at weight 520 with a 2px `--foreground` underline, so the underline never competes with `--primary` for meaning. Upload progress is a 2px `--foreground` determinate rule on `--input`, which is a progress bar and reads as one.

> **"COMPUTED AA FAILURE IN A SHIPPED STATE, ABSENT FROM BOTH TABLES. `--muted-foreground` on `--accent` computes to 4.45:1 in dark, below the 4.5:1 AA floor."**

Fixed and published. `--muted-foreground` is derived rather than chosen: it is the darkest neutral that clears 4.5:1 against every ground it can ever sit on, which in dark is `--secondary` at L 0.320. That gives `oklch(0.695 0 0)`, and the pair this judge caught now measures **5.18:1** in dark and **5.66:1** in light. Both appear in the tables in section 5, along with the same token on `--muted`, `--secondary`, `--popover`, `--card` and `--background`.

> **"§7's ICON BAN IS BROKEN THREE TIMES BY §10 AND §12... `Loader`... a 20px `Camera` glyph and the word `Add photo`... a filled `Check` on the liked state."**

Fixed, all three, by removing the components that needed them. There is no `Loader` because there is no spinner in this product; in-button busy states are the verb in progress plus a determinate 2px rule. The photo control is the words `Take a photo` and `Choose photos` with no glyph. The liked state changes the word (`Like` becomes `Liked`) and carries `aria-pressed`, so it is not colour-only and needs no check mark. The full icon set is six glyphs, enumerated in section 7, and section 12 was written against that list.

> **"§10 BREAKS ITS OWN CAP INSIDE §10. 'Nothing exceeds 220ms.' then 'Its background fades from `--success` at 12% alpha to transparent over 900ms.'"**

Fixed by making it not a motion at all. A newly saved row carries a 2px `--success` left rule for four seconds and then loses it, in both motion modes. Nothing animates, nothing fades, the cap holds, and the reduced-motion path and the normal path are now the same path, which is a smaller system.

> **"THE 15-SECOND PATH IS NOT FIVE CONTROLS... §12 also claims all five sit 'above the fold on a 390x844 phone'; with the keyboard raised for 'What was it' the sheet has roughly 340px of visible height, less than the stack specified."**

Fixed by shortening the path and by not claiming the fold. The fast path is three controls and a save: photo, species, one measurement pair. The stamped facts sit above them as a read-only readout, not as controls. Nothing in this document claims a keyboard-raised layout that was never measured; section 12 states the order and states that the save control is pinned to the bottom edge of the sheet so it is reachable with the keyboard up.

> **"THE DASHED STATE IS NOT SPECIFIABLE AS WRITTEN. CSS `text-decoration-style: dashed` leaves dash and gap lengths to the UA."**

Fixed by removal. Nothing in this system is drawn with a dash.

> **"LIGHT `--warning` oklch(0.52 0.12 73) IS OUTSIDE sRGB (blue channel -0.008). It clips silently."**

Confirmed and fixed. I recomputed that exact token and got an un-clamped linear blue of **-0.00792**, which matches this judge to the digit. The shipped token is `oklch(0.520 0.110 70)`, whose un-clamped linear blue is **+0.00232**. I also checked the next step up: `oklch(0.520 0.115 70)` gives **-0.00203** and clips, so 0.110 is the ceiling at this hue and lightness rather than a guess. Every token in both themes was checked the same way and every one is in gamut (section 5).

> **"NEVER MENTIONS THE DORMANT AI CHAT COMPONENTS the brief explicitly names as an existing surface."**

Fixed. Section 14 refuses the AI surface for this release, on Spec Block's argument, and names where a question-answering surface would belong later. The dead `ChatBot`, `ChatInput`, `ChatMessages` and `TypingIndicator` components come out of the client, and the live `POST /api/chat` endpoint is either switched off or left with no front door and no landing-page promise pointing at it.

> **"BORDERLINE... `--background` oklch(0.972 0.003 85) = #F7F6F3. §5's stated job is 'to stop the chassis reading as cold-tech blue-grey'. That is a designer's job, not a job for an angler."**

Accepted, and the warm cast is gone. Both neutral ramps are chroma exactly 0.000. The job is an angler's job and it is testable: any chroma in the ground biases the apparent colour of the photograph sitting on it, and what colour a fish was is a fact this product is not allowed to distort. Light `--background` is `oklch(0.965 0 0)`, one step below white so the record surface at white is the brightest thing on the page and needs no shadow to say so.

### 0.3 Grafts, each with its source

| Graft | Taken from | Named by |
|---|---|---|
| The capture receipt: the live position and accuracy figure printing inside the control while the capture runs, so the angler knows whether a fix landed before letting the fish go. Taken as a **tap**, not a hold | Stamp First | Field judge ("the best single functional idea in the set"), craft judge ("Graft it as a tap-to-stamp with a live readout rather than a hold"), slop hunter ("Take the readout, drop the press") |
| The record exists from the tap, so dismissing the sheet cannot destroy it | Stamp First | Craft judge, field judge ("kills the audit's draft-loss and orphaned-photo bugs at the architecture level") |
| Partial capture is kept and named. "Whatever landed is kept. What did not land is absent, not zeroed" | Stamp First | Slop hunter, craft judge |
| The plain-English reliability caption, printed only when there is something soft to say | Stamp First | Slop hunter ("A record with nothing soft prints nothing, so the caption earns attention when it appears") |
| The 6 second GPS ceiling, after which the line reads `Waiting for a fix` and Save stays enabled | Spec Block | Field judge ("The best-specified slow-fix behaviour in the three") |
| One family, no mono, with column alignment guaranteed by fixed-width right-aligned cells rather than by a font feature | Spec Block | Slop hunter ("the single best structural decision in the three documents") |
| The no-photo tile as a `--muted` block with a single 1px diagonal corner to corner, and the same block with no diagonal meaning "something is coming" | Spec Block | All three judges |
| Switching the unit chip converts the number already typed | Spec Block | Field judge |
| No `step` attribute, `inputmode="decimal"` | Spec Block, Stamp First | Field judge |
| Weight converted to `lb` and `oz`, never decimal pounds | Spec Block | Field judge |
| The native unit stored per measurement on the record, not as a profile setting | Spec Block | Field judge |
| Five different sentences for five different missing values | Spec Block | Craft judge ("strictly more information than either of the other two directions' single 'not recorded'") |
| Relative time is never the only form | Spec Block | Field judge |
| `gestureHandling: cooperative` on the embedded map | Spec Block | Field judge ("The only direction to name the mechanism rather than the symptom") |
| Editing sends only changed fields | Spec Block | Field judge ("The most precise fix in the set for the silent-data-loss bug") |
| Water type offers the same four options on log and on edit | Spec Block | Field judge |
| Soft delete with a 10 second undo in the toast, instead of a confirmation in front of a reversible delete | Spec Block | Slop hunter |
| The landing density band: the same record shown again as one row inside a list of twelve | Spec Block | Slop hunter, craft judge |
| Four bands and more than three questions on the landing page | Spec Block | Slop hunter ("The only direction in the set that breaks the rule of three at layout scale") |
| No AI surface, with the argument attached | Spec Block | Slop hunter, craft judge |
| The gamut check as a required deliverable | Spec Block | Craft judge ("THE VERIFICATION APPENDIX AS A DELIVERABLE") |
| The weight reserve: the heaviest weight in the product belongs to actions and to measured values, and headings never reach it | Stamp First | Craft judge ("One rule, no stat tiles, no size inflation") |
| Automatic dark between civil dusk and civil sunrise at the device position, with a sticky manual override | Stamp First | Field judge |
| Gear photographed with `object-contain`, because cover chops a rod on a table | Stamp First | Field judge |
| Offline as a first-class state with a visible queue count | Stamp First | Slop hunter, field judge |
| Coordinates added to catch posts so `Near me` plus `Catches` stops being permanently empty | Stamp First | Field judge |
| Trips: a session opened on the first log, later logs attaching to it | Stamp First | Field judge ("delivers Tier C item 21") |
| Radius as affordance: square is content, rounded is something you press | Weigh Slip (base) | Craft judge ("The best structural idea in any of the three"), slop hunter |
| Positive tracking does not exist in the system, so wide-tracked micro-labels are inexpressible rather than forbidden | Weigh Slip (base) | Craft judge, slop hunter |
| `--accent` redefined as a neutral lightness step rather than a colour | Weigh Slip (base) | Field judge ("kills the current teal-flash-on-every-outline-button bug at the token level") |
| Photograph at native ratio, `object-contain`, capped height, on a `--muted` ground | Weigh Slip (base) | Field judge ("The only treatment of the three that guarantees a vertically-held fish is never cropped") |
| `filter: brightness(0.82)` on hero photographs in dark until tapped | Weigh Slip (base) | Field judge ("No other direction noticed that the photo, not the chrome, is the night-vision problem") |
| The Google attribution line defining the entire smallest-type register | Weigh Slip (base) | Craft judge, slop hunter |
| Both unit systems printed on the record itself | Weigh Slip (base), Spec Block, Stamp First, all from the RIO spool label | All three judges |
| The one exception to omitting missing values: the measurements block always prints its labels | Weigh Slip (base), Spec Block | Slop hunter, field judge |
| Skeleton timeouts replaced in place by an inline error with Retry | Weigh Slip (base) | Craft judge |
| Nav as words with no icons | Weigh Slip (base) | Craft judge ("kills the 'desktop says My locations, mobile says Sites' bug class by removing the glyph that let the two drift") |
| The measure line, in any form | **Not grafted** | Rejected by all three judges |
| The press-and-hold gesture | **Not grafted** | Rejected by all three judges |
| The vermilion accent | **Not grafted** | Rejected by the slop hunter and the field judge as the banned outdoor orange |
| Condensed measurement type at `wdth 78` | **Not grafted** | Rejected by the slop hunter and the field judge |

### 0.4 Where I disagree with a judge

**On the accent hue.** The slop hunter wrote of Spec Block: "Magenta is a residue, not a decision. `--primary: oklch(0.480 0.190 328)` arrives after blue, teal, cyan, green, khaki, sand, rust, ochre and lime are each eliminated." I disagree in one line: elimination is the correct method when the constraint set is the product's own content rather than the designer's taste, and the positive job is statable without the elimination. Two of the three places the accent is allowed sit on imagery this product does not draw, a Google map tile and a photograph, so the hue has to be one that is never mistaken for part of the picture, and h 328 is the one saturated family that appears in neither a coastal photograph nor a road map. Picking a hue for how it feels is the thing the brief actually bans.

**On the typeface.** The slop hunter's convergence argument counts Atkinson Hyperlegible Next appearing in two directions as evidence of a default. I disagree in one line: a font chosen because its design brief is literally this product's failure condition is falsifiable, and if a reader can tell a 6 from an 8 in glare at arm's length in any grotesque then the choice is wrong and can be shown to be wrong, which is not true of a font chosen for mood.

**On the primary action's size.** The field judge ranked Stamp First first partly for its 96px full-width control. I disagree in one line: the same judge measured that control's cost at 194px of permanent chrome on every screen including the one holding the fish photograph, and a 148 by 56px block in the corner the thumb already rests in buys most of the reach for none of the chrome.

**On what a confirmation costs.** Weigh Slip's own defence of the un-defaulted toggle was "Choosing 'estimated' is one tap and costs nothing, so honesty has no friction penalty", and the field judge correctly called that "a claim about tap count, not about a blocking validation gate". I agree with the judge and go further: the fix is not to default the toggle to a neutral value, it is to default it to the **weaker** claim, so that a record that nobody touched understates itself rather than overstating itself.

---

## 1. Identity sentence

**Unlike every reference above and unlike Fishbrain, this looks and behaves like a record that says which of its own numbers to trust, because every value prints where it came from in words on the same line, and nothing in this product means anything you have to be taught first.**

Two things follow, and everything below is downstream of them.

**A number with no source is not a fact.** A guessed weight and a weighed weight rendered identically make a log that cannot be compared to itself, which is why the weather snapshot this app already captures is currently worth nothing.

**If it cannot be said in a word, the product does not say it.** No legend, no key, no badge, no colour code, no dash, no asterisk, no tooltip carrying meaning that is not also on the page.

---

## 2. The angler in context

### 06:41, fish in the net, one wet hand, spray on the glass

Maybe fifteen seconds before the fish goes back. What cannot be reconstructed later is the position and the minute.

- **The tap captures before it asks.** One tap on `Log` fires the position request, stamps the clock, starts the conditions pull and writes the record locally. The sheet opens holding all three. Nothing waits for a form.
- **The record exists from that tap.** Dismissing the sheet adds nothing and destroys nothing. This is the whole reason the current build's half-filled form and its orphaned uploads stop being possible.
- **Nothing on the fast path can block a save.** No required field, no un-defaulted toggle, no `step` attribute, no browser validation bubble.
- **A measurement nobody qualified is recorded `by eye`**, because that is the weaker claim and a record should understate rather than overstate itself.
- **48px minimum target, 8px minimum gap, 16px minimum text.** The hand is wet and cold. This is the design condition, not an accessibility footnote.
- **The primary action is in the same corner on every screen**, at the end of the bottom bar, and it is the only filled control in the chrome.

### 05:40, walking down in the dark, eyes adapted

The screen is the only light source. A white flash costs about twenty minutes of night vision and the head torch is already off.

- **Dark is not the light palette flipped.** Peak text luminance is capped at **0.493**, under half the output of white, and body text still clears AAA on every ground (section 5).
- **Dark selects itself** between civil dusk and civil sunrise at the device position, with a manual override that sticks. Theme is written pre-paint by an inline script, so a dark-preference angler never sees the light flash the current build ships.
- **The photograph is the brightest thing, and it is dimmed.** A hero photo renders at `filter: brightness(0.82)` in dark until tapped or focused, because at 04:30 a full-height photograph, not the chrome, is the light source that costs adaptation.
- **Nothing pulses, shimmers or idles.** An infinite animation on a dark screen at 05:00 is the same offence as a flash.

### 11:00, sun overhead, phone in direct light, checking what worked here last spring

Glare. The screen is a mirror, read at arm's length, often through polarised lenses.

- **Body text clears 16.18:1 and secondary text clears 6.58:1** in light. There is no 3.8:1 grey anywhere, and no 11px nav label.
- **Everything is at least 16px** except two named uses of 14px that are read close up at a desk.
- **Provenance is a word, not a mark.** A solid rule and a dashed rule are the first distinction glare destroys. `by eye` is not.
- **Measurements form real columns** in fixed-width right-aligned cells, so a season of weights can be scanned down the page without reading each one.
- **Filters live in the URL**, so a filtered list survives Back and can be sent to someone.

### Sunday evening, 1440px, two hundred rows, and the question is a pattern

- **A list is a list, not a wall of cards.** No border, no card, no shadow on a row. A hairline divides them and a surface tint appears on hover with the gutter permanently reserved, so nothing reflows.
- **Blank trips are rows.** A trip with no fish is a record, and without it the conditions on the successful trips mean nothing.
- **A spot page carries the delta**, not the absolute: pressure and water temperature as the change since this angler's own last visit.
- **Personal bests are stated in words**, on the record and on the profile, and never carried by an emphasis rule that makes 211 of 212 rows quiet.

### A stranger opens a shared catch link, signed out, on a bus

- **Public read, no gate, no app nav.** One sign-in affordance, no bottom bar full of locked destinations.
- **Both unit systems on the record itself**, because her preference is unknowable: `2.27 kg (5 lb 0 oz)`.
- **The record states its own provenance in plain English**, because the numbers mean nothing to someone who was not there unless they say where they came from.
- **`document.title` is the catch.** Every route in the current build reads `client`.

---

## 3. Steal list

No source supplies more than two decisions.

| Take | From | Never take |
|---|---|---|
| A value renders its own reliability rather than being labelled by a badge beside it | U.S. Chart No. 1, NOAA and NGA, 13th edition | The chart's surface. Bathymetry, sounding fields, compass roses, depth rings, the buff and blue and magenta tints as page decoration |
| The unit is printed beside the number every time, and the conversion travels on the artefact rather than living in a setting | U.S. Chart No. 1 | Arial, and the roman versus italic numeral encoding, which only works because every other mark on the sheet is also meaningful |
| Native unit first, conversion in parentheses at the same size on the same line | RIO Fluoroflex tippet spool label | The foil, the die-cut card, and shorthand printed with no measurement beside it |
| When the claim is in doubt, resolve against the claimant | IGFA international angling rules and record application | Affidavits, certification numbers, fees, the adversarial posture, and its licensed display stack |
| The nil return. A trip with no fish is a required record, not an absence | New Jersey Striped Bass Bonus Program mandatory log | The compliance voice. No all-caps, no MANDATORY, no deadlines, no eligibility to revoke |
| No ranges. A measurement field holds a number with a stated source, or it is empty | New Jersey Striped Bass Bonus Program log | Its five-field list as a ceiling. A real catch record needs more |
| "When it happened" and "when it was determined" are two separate stored facts | GBIF occurrence record, Darwin Core | The field names. `occurrenceID`, `decimalLatitude` and `basisOfRecord` are the same class of tell as `CATCH • GLOBAL` |
| The record enumerates its own soft spots in plain English | GBIF occurrence record, Darwin Core | The 105-value issue vocabulary's granularity, and the scientific binomial as the headline |
| A prediction is labelled a prediction and stamped with its source point and its time | NOAA CO-OPS tide predictions and station datums | The almanac page format. Ruled tables of tiny figures, unexpanded abbreviations like MLLW and DTL |
| Capture stamps position and time before any dialog exists | Garmin GPSMAP man-overboard | The chartplotter skin. Dark panels, neon readouts, sweep arcs, gauge bezels, needles |
| A reading is the change since the last one taken at this place, not an absolute nobody can act on | Marine aneroid barometer, the brass set hand | The object. The dial, the glass, the Change and Fair and Stormy arc |
| Hover-only row surface with the gutter permanently reserved, so two hundred rows carry no chrome until pointed at | Linear, dense issue list | Its 13px row text and 10px labels, and the marketing site's `mix-blend-mode: overlay` film grain |
| Non-standard variable weights rather than 500 and 600 and 700 | Linear | The command menu's density as a model for a one-handed phone |
| Record title and headline measurement set at the same size, divided by a hairline rather than boxed in tiles | Strava public activity embed | Its 10 to 13px size ladder, and `#FC5200` at 3.31:1 identifying a link by colour alone |
| Social counts written as one sentence rather than two icon-number chips | Strava public activity embed | The Strava marketing site, which is the opposite of its own record card |
| A neutral chassis with exactly one saturated hue rationed to a named list of jobs | onX "ys" design system | `--ys-color-text-dim` at 4.48:1, the 11px metadata styles, and onX Hunt's `#ff3300` at 3.67:1 |
| A scrim token, a colour with alpha, instead of `backdrop-filter`, which appears zero times in 526,975 bytes of their CSS | onX "ys" design system | The five-vertical ecommerce chassis. This product has one vertical |
| An eight-direction 1px text outline for the one place our own text sits on map tiles | Windy web app | Its two commonest type sizes, 10px and 11px, and its refusal of a system dark mode |
| One plain sentence of interpretation above the numbers, not a chart | Apple HIG, Charting data | Liquid Glass, and any hand-built web imitation of it |
| The 35% dim as a specified number for a control over bright media | Apple HIG, Materials | Glass in the content layer, which the source itself forbids |
| Two body sizes at most, six spacing steps, hierarchy carried by weight | Arc'teryx | Helvetica Now plus Elan ITC Pro plus urw-din, and the editorial serif |
| Square corners as the default surface, radius reserved for things you touch | Arc'teryx | Its mid-migration three-family type stack and its 41px and 50px radius outliers |
| Your own numbers in ink, anything aggregated across other people in grey | Letterboxd | `#678` metadata at 3.87:1, 71 uppercase declarations and 50 wide-tracking declarations |
| The accent spent almost entirely on interaction state rather than on resting fills | Leica | The Splide widget's hard-coded `#0bf` focus ring, and photographs in bordered frames |
| A named minimum touch-target token, sized for the actual hand, rather than trusting the component library | Teenage Engineering | Viewport-proportional type. `calc(.0367 * 100vw)` computes 14.3px body on a 390px phone and ignores user zoom |
| The form opens already holding what the device knows, with optional fields folded into a corner until wanted | Things 3 | "Everything becomes so seamless, it's magical" |
| Candidate entries assembled from context the device already had, with the app blind until the person picks one | Apple JournalingSuggestions | Auto-creating records from observed context, and the gratitude and reflection prompt register |
| The attribution line specified completely, in the same container as the data, and used as the product's only sub-16px type | Google Maps Platform weather attribution policy | Reading the 12sp floor as permission to set anything else small |

---

## 4. Typography

### One family. Atkinson Hyperlegible Next.

| | |
|---|---|
| **Designer** | Braille Institute, Applied Design Works, Elliott Scott, Megan Eiswerth, Letters From Sweden |
| **Foundry and publisher** | Braille Institute of America |
| **Source** | `github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext`. Upstream `github.com/googlefonts/atkinson-hyperlegible-next`. Self-hosted as woff2, never hotlinked |
| **Licence** | **SIL Open Font License, Version 1.1.** Verified at source on 16 September 2026. `OFL.txt` reads `Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next)` and names "SIL Open Font License, Version 1.1", dated 26 February 2007. `METADATA.pb` records `license: "OFL"`, `category: "SANS_SERIF"`, `date_added: "2025-01-07"` |
| **What ships** | `AtkinsonHyperlegibleNext[wght].ttf` and `AtkinsonHyperlegibleNext-Italic[wght].ttf`, both variable, `wght` axis 200 to 800, the italic a drawn italic rather than a synthesised oblique. Both verified in `METADATA.pb` |
| **Subset** | Latin, plus `±` `°` `·` `×`. All four confirmed present in the source as `plusminus`, `degree`, `periodcentered` and `multiply`. The accuracy radius prints `±34 m`, so a subset without `±` would ship a tofu box on the one line the capture receipt exists for |

**Why this face.** It was drawn so that every character stays distinguishable from every other at low acuity and low contrast. That is not a mood, it is the literal failure condition of this product: reading `10 lb 1 oz` or `24 km/h` on a wet phone, in glare, at arm's length, through polarised lenses. The claim is falsifiable, which is the point. If a reader can tell a 6 from an 8 and a 1 from an l under those conditions in any grotesque, this choice is wrong and can be shown to be wrong.

**There is no second family.** Both jobs a mono would have done were checked at source and both are gone.

1. **Column alignment.** `feature tnum` is defined in `sources/AtkinsonHyperlegibleNext.glyphs` and substitutes `zero` through `nine` to their `.tf` tabular variants, alongside `pnum`, `frac`, `sups`, `ordn`, `locl` and `case`. Verified, not assumed. Alignment does not depend on it anyway, because every numeric cell in a list, a table or a measurement rail is a fixed-width right-aligned block.
2. **The slashed zero on a coordinate.** The family ships no `zero.slash`, no `zero.dotted` and no stylistic set carrying one, so it is not available. Checking why it was wanted retired the argument: a coordinate in this product is `-34.13291, 18.43056`, which is digits, a minus, a comma and a full stop. There is no `O` in the string for a `0` to be confused with.

There is also no serif, no display face, no icon font and no system stack.

### Scale

Base 16px, ratio **1.200**. Six tokens, one of which is off-ratio and is named.

| Token | px / line-height | Ratio step | Role |
|---|---|---|---|
| `--t-meta` | 14 / 20 | 16 ÷ 1.143, off-ratio | **Two uses in the whole product, both read close up:** the weather attribution line, and helper or validation text beside a field. Never a row sub-line, never a nav label, never a caption on a photograph, never a paragraph |
| `--t-body` | 16 / 24 | base | Everything else. Body copy, all labels, all inputs, all buttons, all nav words, all list-row text including the sub-line, all comment text |
| `--t-sub` | 19 / 24 | 1.200 | Section headings inside a record. Record title and headline measurement inside a list row and a feed post |
| `--t-title` | 23 / 28 | 1.200 | Page `h1` and record title below 1024px, and the headline measurement beside it |
| `--t-title-lg` | 28 / 32 | 1.200 | The same two roles from 1024px |
| `--t-hero` | 40 / 44 | two steps, 34 skipped | The signed-out landing `h1`. Appears once in the product |

Step 34 is deliberately unused, so the one marketing headline is visibly not an in-app heading.

`h1 { font-size: clamp(23px, 1.3rem + 1vw, 28px); }` is the only `clamp()` in the product.

**Floor.** Nothing renders below 14px, and 14px has exactly the two uses named above, which a reviewer can count by grepping for `--t-meta`. Body copy and every `<input>`, `<select>` and `<textarea>` are 16px on every breakpoint, inside sheets and search fields included, which also stops iOS Safari zooming on focus. 16 rather than 17 because 16 is the number with a reason attached and nothing measured separates 17 from 16. That removes the 11px nav labels, the 10px gallery badges and the 12px toast descriptions the current build ships.

### Weights

Three, all from the variable axis, none of them a default step.

- **400** Body, notes, descriptions, row sub-lines, the provenance line, the source word.
- **520** Labels, nav words, section headings, **page titles and record titles**, table headers, filter chips, secondary button labels.
- **620** Primary button labels, and **every measurement value**. Nothing else reaches it.

**The weight reserve.** 620 belongs to two things, actions and measured values, and a heading never reaches it. That is the cheapest way to make the measurement the loudest thing on a record without making it physically bigger, and it is why this product has no stat tiles. A 23px title at 520 beside a 23px measurement at 620 is the whole argument of the catch detail page in one line.

### Line heights

20 at 14px, 24 at 16px and 19px, 28 at 23px, 32 at 28px, 44 at 40px. Every value lands on the 4px grid.

### Tracking

| Size | Tracking |
|---|---|
| 40px | −0.02em |
| 28px | −0.015em |
| 23px | −0.01em |
| 19px | −0.005em |
| 16px and 14px | 0 |

**There is no positive letter-spacing token in this system, and no `text-transform: uppercase` anywhere.** Acronyms inside sentences (`GPS`, `UV`, `SAST`) are the only capitals. Wide-tracked micro-labels, numbered eyebrows and pill badges are therefore not expressible rather than merely discouraged.

### Figures

- `font-variant-numeric: lining-nums tabular-nums` on the `.numeral` role: every measurement, count, date, time, coordinate and page indicator.
- Numerals inside running prose stay proportional and inherit body settings.
- Oldstyle figures are never used.
- Column alignment is carried by fixed-width right-aligned cells (`--w-length: 88px`, `--w-weight: 104px`, `--w-date: 128px`, `--w-count: 48px`), so it holds whether or not the feature is present at runtime. `tnum` is a verified improvement on top, not a dependency.

### Italic

Reserved for a Latin binomial where one appears (`Argyrosomus japonicus`). It is never used for emphasis, never in a headline, never on one word of a sentence.

### Measure

`max-width: 68ch` on notes, descriptions, access notes and comment bodies. The single content column is 720px. Body is left-aligned and never justified.

---

## 5. Colour

The angler's photograph and the map tiles are the only things on screen that have earned colour. Everything else is a neutral chassis with one saturated hue, rationed.

**The neutral is chroma exactly 0.000 in both themes.** Not cream, not bone, not parchment, not warm grey, not cool grey. The job is an angler's job and it is testable: any chroma in the ground biases the apparent colour of the photograph sitting next to it, and what colour a fish was is a fact this product is not allowed to distort. This also means the neutral is the same hue family in both themes, so the chassis does not change character when the theme flips.

**The dark theme is re-derived, not inverted.** Three role changes.

1. **Peak luminance is capped by rule.** `--foreground` in dark is the lowest lightness that still clears 7:1 on `--card`, the hardest of its grounds, while keeping relative luminance under half that of white. That resolves to `oklch(0.790 0 0)`, relative luminance **0.493** against white's 1.000, and it still measures 8.62:1 on `--card` and 9.64:1 on `--background`. No text on a dark screen emits more than half the light of white.
2. **The surface sits above the page.** `--card` L 0.235 over `--background` L 0.185, the same direction as light where `--card` is white over L 0.965. The relationship never inverts between themes.
3. **The accent is re-picked for its own ground**, not reused. Chroma drops from 0.200 to 0.140 and lightness rises to 0.670, so a full-width primary control is relative luminance **0.278**, a little over a quarter of white.

I am not claiming the neutral's hue does night-vision work. It cannot: at near-zero chroma the blue output of a grey is set by its lightness, so the lightness cap is the whole mechanism and the hue rotation would be a story.

### Light tokens

| Token | OKLCH | Hex | In sRGB gamut |
|---|---|---|---|
| `--background` | `oklch(0.965 0.000 0)` | `#F3F3F3` | yes |
| `--foreground` | `oklch(0.205 0.000 0)` | `#171717` | yes |
| `--card` | `oklch(1.000 0.000 0)` | `#FFFFFF` | yes |
| `--card-foreground` | `oklch(0.205 0.000 0)` | `#171717` | yes |
| `--popover` | `oklch(1.000 0.000 0)` | `#FFFFFF` | yes |
| `--popover-foreground` | `oklch(0.205 0.000 0)` | `#171717` | yes |
| `--primary` | `oklch(0.470 0.200 328)` | `#911791` | yes |
| `--primary-foreground` | `oklch(0.990 0.000 0)` | `#FCFCFC` | yes |
| `--secondary` | `oklch(0.925 0.000 0)` | `#E6E6E6` | yes |
| `--secondary-foreground` | `oklch(0.265 0.000 0)` | `#252525` | yes |
| `--muted` | `oklch(0.945 0.000 0)` | `#EDEDED` | yes |
| `--muted-foreground` | `oklch(0.455 0.000 0)` | `#575757` | yes |
| `--accent` | `oklch(0.915 0.000 0)` | `#E3E3E3` | yes |
| `--accent-foreground` | `oklch(0.205 0.000 0)` | `#171717` | yes |
| `--destructive` | `oklch(0.505 0.200 27)` | `#BC0E18` | yes |
| `--destructive-foreground` | `oklch(0.990 0.000 0)` | `#FCFCFC` | yes |
| `--border` | `oklch(0.870 0.000 0)` | `#D4D4D4` | yes |
| `--input` | `oklch(0.600 0.000 0)` | `#808080` | yes |
| `--ring` | `oklch(0.470 0.200 328)` | `#911791` | yes |
| `--success` | `oklch(0.460 0.120 152)` | `#036A34` | yes |
| `--success-foreground` | `oklch(0.990 0.000 0)` | `#FCFCFC` | yes |
| `--warning` | `oklch(0.520 0.110 70)` | `#915C08` | yes |
| `--warning-foreground` | `oklch(0.990 0.000 0)` | `#FCFCFC` | yes |

### Dark tokens

| Token | OKLCH | Hex | In sRGB gamut |
|---|---|---|---|
| `--background` | `oklch(0.185 0.000 0)` | `#131313` | yes |
| `--foreground` | `oklch(0.790 0.000 0)` | `#BABABA` | yes |
| `--card` | `oklch(0.235 0.000 0)` | `#1E1E1E` | yes |
| `--card-foreground` | `oklch(0.790 0.000 0)` | `#BABABA` | yes |
| `--popover` | `oklch(0.275 0.000 0)` | `#282828` | yes |
| `--popover-foreground` | `oklch(0.790 0.000 0)` | `#BABABA` | yes |
| `--primary` | `oklch(0.670 0.140 328)` | `#C374C0` | yes |
| `--primary-foreground` | `oklch(0.160 0.000 0)` | `#0D0D0D` | yes |
| `--secondary` | `oklch(0.320 0.000 0)` | `#333333` | yes |
| `--secondary-foreground` | `oklch(0.790 0.000 0)` | `#BABABA` | yes |
| `--muted` | `oklch(0.260 0.000 0)` | `#242424` | yes |
| `--muted-foreground` | `oklch(0.695 0.000 0)` | `#9D9D9D` | yes |
| `--accent` | `oklch(0.290 0.000 0)` | `#2B2B2B` | yes |
| `--accent-foreground` | `oklch(0.790 0.000 0)` | `#BABABA` | yes |
| `--destructive` | `oklch(0.645 0.170 27)` | `#E25C52` | yes |
| `--destructive-foreground` | `oklch(0.160 0.000 0)` | `#0D0D0D` | yes |
| `--border` | `oklch(0.340 0.000 0)` | `#383838` | yes |
| `--input` | `oklch(0.595 0.000 0)` | `#7F7F7F` | yes |
| `--ring` | `oklch(0.670 0.140 328)` | `#C374C0` | yes |
| `--success` | `oklch(0.680 0.120 152)` | `#59AD73` | yes |
| `--success-foreground` | `oklch(0.160 0.000 0)` | `#0D0D0D` | yes |
| `--warning` | `oklch(0.750 0.110 70)` | `#DBA15C` | yes |
| `--warning-foreground` | `oklch(0.160 0.000 0)` | `#0D0D0D` | yes |

Two tokens beyond the shadcn set, both replacing an effect rather than adding one:

- `--scrim: rgb(0 0 0 / 0.35)` in both themes, for a dialog or a sheet over the page, and for the map under a sheet. There is no `backdrop-filter` in this product.
- `--label-outline`, the eight-direction 1px text outline for the one place our own text sits on map tiles: `rgb(0 0 0 / 0.55)` at the cardinals, `rgb(45 45 45 / 0.60)` at the diagonals.

`color-scheme: light dark` is declared on `:root`, so native selects, date pickers, number spinners and scrollbars follow the theme instead of staying light on a dark page. Theme is written pre-paint by an inline script in `index.html`. `ClerkProvider` receives an `appearance` prop built from these tokens.

### Two tokens are derived, not chosen

- **`--input` is the lightest neutral in light, and the darkest in dark, that still clears 3:1 against every ground a control boundary can sit on**, which is `--card`, `--background`, `--muted`, `--secondary` and `--accent`. In light the binding ground is `--accent` and the answer is L 0.600. In dark the binding ground is `--secondary` and the answer is L 0.595. The two land within 0.005 of each other, which is a consequence of the rule rather than a coincidence.
- **`--muted-foreground` is the darkest neutral in light, and the lightest in dark, that still clears 4.5:1 against all five of those grounds.** In light, L 0.455. In dark, L 0.695. This is the token that produced the AA failure the craft judge found in the base direction, so it is derived rather than picked.

### Computed contrast, light

Every ratio below was computed from the OKLCH values above through OKLab to linear sRGB to WCAG relative luminance. None is estimated.

| Pair | Where it is used | Ratio |
|---|---|---:|
| `foreground` on `background` | Body text on the page | **16.18:1** |
| `foreground` on `card` | Body and measurement values on a record | **17.91:1** |
| `muted-foreground` on `card` | Source word, row sub-line and provenance line on a record | **7.28:1** |
| `muted-foreground` on `background` | Source word and row sub-line on the page | **6.58:1** |
| `muted-foreground` on `accent` | Row sub-line while the row is hovered or focused | **5.66:1** |
| `foreground` on `accent` | Row title while the row is hovered or focused | **13.92:1** |
| `muted-foreground` on `muted` | Text inside the read-only conditions block | **6.20:1** |
| `muted-foreground` on `secondary` | Label on a secondary control | **5.84:1** |
| `foreground` on `muted` | Text over a skeleton or a no-photo block | **15.25:1** |
| `secondary-foreground` on `secondary` | Secondary button label | **12.26:1** |
| `primary-foreground` on `primary` | Primary button label | **7.44:1** |
| `destructive` on `card` | Delete control and inline validation text on a record | **6.52:1** |
| `destructive` on `background` | Inline validation text on the page | **5.89:1** |
| `success` on `card` | Saved and synced text | **6.73:1** |
| `warning-foreground` on `warning` | Offline bar label on the offline bar | **5.49:1** |
| `warning` on `card` | Warning text where the bar is not used | **5.65:1** |
| `input` on `card` | Field and photo boundary on a record, SC 1.4.11 | **3.95:1** |
| `input` on `background` | Field boundary on the page, SC 1.4.11 | **3.57:1** |
| `input` on `muted` | Boundary of a muted tile, SC 1.4.11 | **3.36:1** |
| `input` on `secondary` | Boundary of a secondary control, SC 1.4.11 | **3.16:1** |
| `input` on `accent` | Boundary inside a hovered row, SC 1.4.11 | **3.07:1** |
| `ring` on `background` | Focus ring on the page, SC 2.4.13 | **6.92:1** |
| `ring` on `card` | Focus ring on a record, SC 2.4.13 | **7.66:1** |
| `ring` on `muted` | Focus ring inset on a photo tile, SC 2.4.13 | **6.52:1** |
| `primary` against `destructive` | Never adjacent. See the accent rule | **1.17:1** |
| `border` on `background` | Hairline divider, decorative, exempt from 1.4.11 | **1.34:1** |
| `card` on `background` | Surface step, decorative, always paired with a hairline | **1.11:1** |

Relative luminance: `foreground` 0.009, `background` 0.899, `card` 1.000, `primary` 0.087.

### Computed contrast, dark

| Pair | Where it is used | Ratio |
|---|---|---:|
| `foreground` on `background` | Body text on the page | **9.64:1** |
| `foreground` on `card` | Body and measurement values on a record | **8.62:1** |
| `muted-foreground` on `card` | Source word, row sub-line and provenance line on a record | **6.12:1** |
| `muted-foreground` on `background` | Source word and row sub-line on the page | **6.85:1** |
| `muted-foreground` on `accent` | Row sub-line while the row is hovered or focused | **5.18:1** |
| `foreground` on `accent` | Row title while the row is hovered or focused | **7.30:1** |
| `muted-foreground` on `muted` | Text inside the read-only conditions block | **5.71:1** |
| `muted-foreground` on `secondary` | Label on a secondary control | **4.66:1** |
| `foreground` on `muted` | Text over a skeleton or a no-photo block | **8.04:1** |
| `secondary-foreground` on `secondary` | Secondary button label | **6.56:1** |
| `primary-foreground` on `primary` | Primary button label | **6.07:1** |
| `destructive` on `card` | Delete control and inline validation text on a record | **4.67:1** |
| `destructive` on `background` | Inline validation text on the page | **5.22:1** |
| `success` on `card` | Saved and synced text | **6.09:1** |
| `warning-foreground` on `warning` | Offline bar label on the offline bar | **8.57:1** |
| `warning` on `card` | Warning text where the bar is not used | **7.36:1** |
| `input` on `card` | Field and photo boundary on a record, SC 1.4.11 | **4.14:1** |
| `input` on `background` | Field boundary on the page, SC 1.4.11 | **4.63:1** |
| `input` on `muted` | Boundary of a muted tile, SC 1.4.11 | **3.86:1** |
| `input` on `secondary` | Boundary of a secondary control, SC 1.4.11 | **3.15:1** |
| `input` on `accent` | Boundary inside a hovered row, SC 1.4.11 | **3.50:1** |
| `ring` on `background` | Focus ring on the page, SC 2.4.13 | **5.82:1** |
| `ring` on `card` | Focus ring on a record, SC 2.4.13 | **5.21:1** |
| `ring` on `muted` | Focus ring inset on a photo tile, SC 2.4.13 | **4.86:1** |
| `primary` against `destructive` | Never adjacent. See the accent rule | **1.11:1** |
| `border` on `background` | Hairline divider, decorative, exempt from 1.4.11 | **1.59:1** |
| `card` on `background` | Surface step, decorative, always paired with a hairline | **1.12:1** |

Relative luminance: `foreground` 0.493, `background` 0.006, `card` 0.013, `primary` 0.278.

Body text clears 7:1 in both themes. Every operable boundary and every focus indicator clears 3:1 against every ground it can land on. `--border` is a hairline between rows and sections and is never the only signal that something is interactive, which is why it is exempt; `--input` carries that duty and is measured for it against five grounds per theme.

### Gamut

Every token in both themes was checked by computing un-clamped linear RGB and rejecting any channel outside `[-0.002, 1.002]`. All 46 pass. Two findings worth recording, because a clipped token silently ships a different colour from the one written down:

- The base direction's light `--warning` at `oklch(0.52 0.12 73)` computes an un-clamped linear blue of **-0.00792** and clips. That matches the craft judge's finding to the digit.
- Our light `--warning` sits at chroma 0.110, blue **+0.00232**. The next step, `oklch(0.520 0.115 70)`, computes blue **-0.00203** and clips, so 0.110 is the measured ceiling at this hue and lightness rather than a round number.

### The accent rule

`--primary` appears in **three** places and nowhere else.

1. The fill of the one primary action visible on a screen. Never two on one screen.
2. The angler's own pin on a map. Other anglers' pins are `--muted-foreground`.
3. The focus ring, `--ring`, at 2px with a 2px offset.

It is banned from likes, comments, follow, links, water types, weather, gear types, section headings, active nav, icons, borders, backgrounds, any hover or pressed fill, any badge, any chart series and any gradient. There are no gradients.

I removed the fourth job the base direction had, `caret-color`. The focus ring already says which field the keyboard is in, so the caret was a second signal for one fact. It was also the single decision all three directions arrived at independently, which is on its own a reason to check whether it was doing work. It was not.

**Why h 328.** Two of the three permitted uses sit on imagery this product does not draw. A map pin sits on Google's tiles, which are blue water, green parks, buff and grey land, amber roads and a red-orange default marker. A focus ring can land on a photograph, which for this audience is water, sky, sand, rock and a fish in silver, olive, brown or pink. The accent has to be a hue that is never mistaken for part of the picture, and it has to be far from `--destructive`. Berry magenta at h 328 is the one saturated family that clears all of it.

**`--primary` and `--destructive` measure 1.17:1 in light and 1.11:1 in dark, and that is published above rather than left out.** The system answers it with shape rather than with luminance: **a destructive control is never a filled block.** Delete is a text control, and the confirm inside a delete dialog is an outline control with a 1px `--destructive` boundary and `--destructive` text at 6.52:1 light and 4.67:1 dark. `--primary` is the only saturated fill in the product. The two can therefore never be confused by anyone, including a reader who sees no hue difference at all, because they are different objects. It also removes the solid red Delete from every row of a 184-row list.

`--destructive-foreground` and `--success-foreground` are defined so that a stray shadcn variant reaching for them is legible, and the product uses neither: nothing is filled with `--destructive` or `--success`. `--warning-foreground` has one real job, the offline bar.

**`--accent` is a neutral lightness step, not a colour.** In the current build `--accent` is teal and it is the generic hover fill, which is why Like, Comment, Follow, Save and every filter chip flash aqua. Defining it as a grey kills that class of bug at the token level rather than component by component.

**Aggregate data is never coloured.** A figure that is the angler's own renders in `--foreground`. A figure averaged across other people renders in `--muted-foreground`, same size, same position. That is the only signal needed and it is the Letterboxd mechanism.

**No state is carried by colour alone.** Liked changes its word. Active nav carries an underline and `aria-current`. Selected carries a 2px left rule. Error carries text beside the field. Provenance carries a word.

---

## 6. Space, radius, borders, elevation

### Spacing, six steps

All on the 4px grid.

| Token | px | Used for |
|---|---|---|
| `--s-1` | 4 | Value to its source word, label to its own sub-line, inside a chip |
| `--s-2` | 8 | Label to field, between two adjacent controls, inside a button |
| `--s-3` | 12 | Row inner padding, list item gap |
| `--s-4` | 16 | Between fields in one group, between related blocks |
| `--s-5` | 24 | Record surface padding, between field groups |
| `--s-6` | 40 | Between sections of a record and between page regions |

There is no seventh. No `gap-5`, no ad-hoc 20px, no 32px. **Related blocks sit at `--s-3` or closer and unrelated blocks at `--s-5` or further**, so the gap between two groups is always at least double the gap inside a group, and proximity carries grouping without a box. The current build's `gap-3` everywhere is why every page is structurally identical with no hierarchy.

Three named singletons that answer to something outside the rhythm:

- `--gutter: 16px`, becoming 24px from 640px and 32px from 1024px.
- `--tap-min: 48px`. Every interactive element is at least 48px on its short axis, above the 44px WCAG 2.2 floor, because the hand is wet and cold. The current build's 32px row buttons, 36px theme toggle, 32px carousel arrows and 26px pagination buttons are all illegal under this token.
- `--tap-gap: 8px` minimum between two targets.

Containers: page shell `max-width: 1200px`, list and feed column 720px, record and form column 720px. **The header uses the same shell as the content**, so the brand and the content share a left edge at every width. That is the direct fix for the current 1152 over 896 mismatch.

### Radius, two values and each one means something

| Token | Value | Applies to |
|---|---|---|
| `--r-0` | 0 | Record surfaces, list rows, photo frames, map frames, dialogs, sheets, panels, thumbnails, tables, skeleton blocks |
| `--r-control` | 4px | Buttons, inputs, selects, textareas, chips, filter chips, toggles, the progress rule |
| `--r-full` | 9999px | Avatars, and nothing else |

**The rule, with a job: a radius means you can press it.** Square things are content, rounded things are controls. Nothing rounded is inert and nothing square is tappable. In glare, where colour and weight both degrade, the corner still says what you can touch. It removes `rounded-lg`, `rounded-xl`, `rounded-2xl` and `rounded-3xl` in one move, and it removes the 10px shadcn default, which is now the most recognisable corner on the web.

4px rather than 6px because 6px is shadcn `sm`, 8px is `md` and 10px is the default. At 4px the curvature is one whole device pixel at 1 dppx and four at 2 dppx, so the distinction survives the cheapest screen in this audience. Filter chips are 4px rectangles, not pills, which kills the pill-badge tell outright.

### Borders

| Use | Weight | Token |
|---|---|---|
| Structural hairline: row separator, section rule, the line under a heading | 1px | `--border` |
| Control boundary: input, select, textarea, secondary and outline buttons, photo tile, map frame | 1px | `--input` |
| Focus | 2px solid, `outline-offset: 2px` | `--ring` |
| Selected row, and the current nav destination | 2px rule | `--foreground` |
| Determinate progress | 2px rule, `--foreground` on `--input` | |
| Overlay boundary: sheet, dialog, popover, toast | 1px | `--border` |

**No dashed border exists in this product, in any state, on any component.** No `0.5px` hairlines either; they vanish at 1 dppx and look broken at 3 dppx.

On a photo tile the focus ring goes inset (`outline-offset: -4px`) so it is not clipped by the image.

A record is not a box. It is a surface one lightness step off the page, separated from what is above and below it by a hairline. Only two things in this system draw a full border, a field and a photograph, so card inside card inside card is not constructible.

### Elevation

**Zero `box-shadow` declarations in the entire product.** Grep-auditable. Depth is three things and only three things: the one-step lightness difference between `--card` and `--background`, a 1px hairline, and `--scrim` behind anything that covers the page.

**Zero `backdrop-filter` declarations.** The sticky header is opaque `--background`. The bottom bar is opaque `--background` with a 1px top hairline. A sheet over a map dims the map with `--scrim` at 35%, a specified number rather than a taste call, and the tiles stay readable underneath.

Measured precedent from the references: Arc'teryx ships zero `backdrop-filter` in 126,677 bytes of CSS, onX ships zero in 526,975 bytes, Windy ships one in 94,073 bytes, Letterboxd ships one in 1,107,544 bytes. The software with the strongest claim on translucency does not use it. The current build puts it on the header, the dock, the mobile bar and the feed panel, and the feed panel blurs a background with nothing behind it.

---

## 7. Iconography

### The whole set

Six glyphs, from Lucide, which is already in the project.

`X`, `ChevronLeft`, `ChevronRight`, `ChevronDown`, `MapPin`, `Crosshair`.

Stroke **1.75px**, two sizes only, **20px** standalone and **16px** inline, always `currentColor`, never filled, never given a colour of its own, never placed inside a shape. Lucide's default 2px stroke at 24px is visibly heavier than 16px Atkinson at 400 sitting beside it; 1.75 at 20 matches.

### An icon is allowed in exactly two situations

1. **It is the entire content of a control and no word fits.** `X` closes a sheet or dialog and removes a photo tile. `ChevronLeft` and `ChevronRight` step a gallery. `ChevronDown` opens a disclosure.
2. **It marks a position on a map, where a word would cover the tiles.** `MapPin` is the marker. `Crosshair` is the centre-on-me control sitting on the map surface.

### Icons are banned, and here is where the previous drafts broke their own ban

- **Beside a text label.** If there is a word, there is no icon. This is the single loudest tell the current build carries.
- **In the navigation.** Nav is five words. No `Fish`, no `MapPin`, no `Wrench`, no `Radio`, no `LayoutGrid`, and no `Plus` meaning two different things.
- **On a button that already has a word.** `Save catch` gets no check mark. `Delete` gets no bin. `Add photos` gets no camera.
- **As a busy indicator.** There is no `Loader` in this product because there is no spinner. A busy button is the verb in progress plus a determinate 2px rule.
- **On the like control.** The word changes from `Like` to `Liked` and the control carries `aria-pressed`. No check, no heart.
- **On the weather.** There is no weather glyph. The current icon tile duplicates the description text beside it and prints the literal words `Weather icon` when it fails.
- **On a search field.** The field has a visible label. A magnifier beside a label is decoration.
- **As a gear type marker.** Lucide has no rod, no lure and no weights, so seven type markers would be seven approximated fishing-tackle line drawings, which is the banned category. Gear type is a word and a grouping heading.
- **Inside a tinted rounded square.** No icon chips, ever. The current logo tile is exactly this.
- **On a section heading, an empty state, a stat, a toast, a badge, a bullet, or as the brand mark.**

If a seventh glyph is ever proposed, the answer is almost certainly a word.

---

## 8. Photography and imagery

The photographs are the only colour this product did not author. They get the room and none of the decoration.

### Crop ratios by context

| Context | Ratio | Fit | Frame |
|---|---|---|---|
| Catch hero, every breakpoint | **Native**, capped at `max-height: 70svh` | `contain` on a `--muted` ground | Square, no border, no shadow |
| Feed post photo | Native, clamped between 16:9 and 4:5 | `cover` only when the native ratio falls outside those bounds | Full bleed to the surface edge, square |
| List row thumbnail | 1:1 at 56px, 64px from 768px | `cover` | Square, 1px `--input` |
| Spot hero | 3:2 | `cover` | Square, no border |
| Gear photo | 3:2 | **`contain`** on a `--muted` ground | Square, 1px `--input` |
| Profile gallery tile | 1:1 | `cover` | Square, no border |
| Avatar | 1:1, 40px in rows, 64px on a profile | `cover` | `--r-full`, no border |
| Map frame | 3:2 below 1024px, 16:9 above | n/a | Square, 1px `--input` |

**A catch photo is never cropped to a fixed height, at any breakpoint.** The current `h-96 object-cover` decapitates every portrait fish photo, which is the one thing the angler came to see. Gear is `contain` too, because a rod photographed on a table is long and thin and cover chops it.

Every media box declares `aspect-ratio` and carries explicit `width` and `height`, so nothing reflows on load. Every image is `loading="lazy"` except the catch hero, which is `fetchpriority="high"`.

### Framing

**No photograph is put in a picture frame.** No inset border on a hero, no rounded corner, no drop shadow, no white mat. The hairline appears only where a photo abuts the page ground rather than a surface, so the edge of a dark photo does not dissolve into a dark page. Magnum Photos wraps the best photojournalism on earth in `padding: 4px; border: 1px solid #ddd`, and that is the anti-lesson.

**In dark, a hero photograph renders at `filter: brightness(0.82)` until tapped or focused.** At 04:30 a 70svh photograph is by far the largest light source on the screen, and it is the photograph rather than the chrome that costs dark adaptation.

### Text over a photograph

**Never, on any breakpoint.** Titles, dates, species, counts and badges all sit below the image on the surface. No scrim is ever composited over an angler's picture and no picture is ever darkened for legibility, so the worst-case contrast problem does not exist. A 35% dim over a mid-luminance photograph measures 3.78:1 for white text and fails; a 0.72 scrim over a blown-out sky measures 3.15:1 and also fails. The correct answer is to put the text somewhere else.

**One exception, and it is not a photograph.** A spot name on map tiles uses an eight-direction 1px `--label-outline` sitting directly on the tiles, with no plate, no pill, no card and no blur. The contrast source is the outline rather than the tile, so it works over a green park, a blue bay or a grey road. That is Windy's mechanism and it is the reason the map stays a map.

### The no-photo state

- **No photo:** a `--muted` rectangle at the context's ratio with a 1px `--input` boundary and a single 1px `--input` diagonal corner to corner.
- **Photo loading:** the same rectangle, no diagonal, no animation.
- **Photo failed:** the diagonal, plus one 14px line below the tile reading `Photo did not load. Tap to try again.`

This replaces five strings the current build ships for one state (`No img`, `No image`, `No image yet`, `No images uploaded`, and nothing at all on My gear) and adds a distinction the current build cannot express.

**This is a mark, and section 11 bans marks that carry meaning. The line is this: no distinction whose misreading costs the angler anything may be carried by a mark.** Misreading a diagonal costs nothing, because both states read as "no picture here" and the angler loses no information either way. Misreading a solid rule as a dashed one under a weight costs a false comparison three seasons later. That is why one survives and the other does not.

The block carries `alt=""` and `aria-hidden`. The absence of a photograph is not an error and does not need announcing.

### Alt text

Built from the record, never from the field name. `Kob, 78 cm, Kalk Bay, 15 September`. Never `Post`, never `Catch`, never `Catch images 1`.

### Illustration

**There is none.** No empty-state art, no spot illustration, no mascot, no line-art fish, no hook glyph, no wave motif, no crest, no vintage badge, and no placeholder slot shipped as visible UI. The current landing page ships three `border-dashed` boxes containing developer instructions and all three are deleted rather than filled.

### The wordmark

The name is undecided, so nothing is drawn. The wordmark is the supplied name set in Atkinson Hyperlegible Next at 520, sentence case, tracking −0.01em, in `--foreground`. The favicon is the name's first letter in the same setting on `--background`.

There is no rule under it, no crest and no mark. A rule under a wordmark is a graphic with a story attached, and at 16px a letter and a mark are equally legible while only the letter survives a rename. When the product has a name, the mark is a design job with a brief; until then this is a placeholder and is written down as one.

---

## 9. Data display

### Length and weight

Canonical storage stays cm and kg. Display prints **both systems on one line, the unit the angler typed outside the parentheses and the conversion inside, at the same size**:

```
78 cm (30.7 in)
4.2 kg (9 lb 4 oz)      by eye
```

- **Units offered.** Length `cm` and `in`. Weight `kg`, `lb` and `lb + oz`. Feet are removed: nobody measures a fish in feet, and offering `ft` with no `in` is what turns a 45 cm fish into 1371.6 cm when the unit is switched after typing.
- **Weight converts to pounds and ounces**, never decimal pounds, because that is how anglers speak. `9 lb 4 oz`, not `9.25 lb`. Length converts to inches at one decimal. No vulgar fractions, ever; `18½ in` and `4.2` do not belong on the same record.
- **The entered unit is stored per measurement, on the record, forever.** Not a profile setting. A fish weighed on a bank scale in pounds still says so three seasons later. The profile setting chooses which unit the keypad opens on, never which units are displayed.
- **Switching the unit chip converts the number already typed.** It never reinterprets it.
- **Value and unit are one `white-space: nowrap` string.** They never break across lines and the unit is never a smaller, quieter span that can wrap away from its number.
- **Precision is preserved, never padded.** `5 kg`, not `5.00 kg`. The conversion rounds to the same number of significant figures as the entry, and at a midpoint a value measured on an instrument rounds down, against the claim.
- **No `step` attribute.** `inputmode="decimal"` and `min="0"`. `step="0.1"` currently blocks `2.25`, which is a value the app itself generates when it converts 5 lb. Negatives are rejected beside the field, not saved as `-60.96`.
- **No ranges, no sliders, no "about".** A measurement field holds a number with a stated source, or it is empty.
- **Length and weight are shown everywhere a catch appears**, including My catches, where they are currently fetched and never rendered.

### The source word

| Fact | How it was obtained | Renders |
|---|---|---|
| Length or weight | Instrument | `78 cm (30.7 in)` |
| Length or weight | The angler's judgement, which is the default | `4.2 kg (9 lb 4 oz) by eye` |
| Position | A live fix | `-34.13291, 18.43056 ±8 m` |
| Position | The pin stored on a saved spot | `-34.13291, 18.43056 from the spot` |
| Position | Placed by hand on the map | `-34.13291, 18.43056 placed by hand` |
| Position | None taken | The block is absent, and the provenance line says `No position taken.` |
| Conditions | Always a forecast at a grid point | See below |

The source word is the same size as the value, weight 400, `--muted-foreground`, and it sits inside the same string separated by `--s-1`. It is never a badge, never a superscript, never a tooltip.

### Date and time

One format, product-wide, replacing the four that coexist today.

- **Absolute, always:** `Tue 15 Sep, 06:42`. The year is appended only when the record is not from the current year: `Tue 15 Sep 2025, 06:42`. Day of week included, because anglers think in days and tides.
- **24 hour. Never seconds. Never `toLocaleString()`**, which currently produces `9/15/2026, 6:42:13 AM` on one device and `15/09/2026, 06:42:13` on another. Never raw UTC in an input.
- **Time zone is the catch's, not the browser's.** Rendered in the zone of the catch's coordinates when they exist, with the abbreviation appended only when it differs from the reader's own: `Tue 15 Sep, 06:42 SAST`. A catch with no coordinates renders in the reader's zone with no abbreviation. A fish caught in Cape Town reads 06:42 in London, because the fact is what time it was where the fish was.
- **Relative time is never the only form.** It is a suffix in the feed and in lists, never alone: `Tue 15 Sep, 06:42 · 3 days ago`. A relative-only timestamp cannot be compared against another record, which is the whole job of a log.
- **Caught and logged are two stored facts.** A record prints `Caught` always, and adds `Logged 21:15.` whenever the gap exceeds 60 minutes. The honesty of the conditions snapshot depends on that gap, so it is printed rather than hidden.
- The editor renders local time and saves an offset-aware ISO string, which removes the two-hour drift that currently moves a Johannesburg catch earlier on every save.

### Weather, in priority order

The current build shows about twelve fields of equal weight across three vocabularies. Here the order is fixed.

**One plain sentence above the numbers**, in the manner of Apple's `Chance of light rain in the next hour`. If the data cannot support a sentence honestly, no sentence is written.

> Light rain, wind rising from the south-west.

**Then three fields, always visible, in this order.**

1. **Wind.** Speed, direction and gust. It decides whether a spot is fishable and which bank you stand on. Direction is written as a word at eight-point resolution: `South-west 24 km/h, gusting to 38`. Not `SSW`, which is jargon to most of this audience, and not sixteen points, which is finer than anyone acts on.
2. **Pressure, as the change against this angler's own last reading at this spot.** `1013 hPa, down 6 since your last trip here.` The absolute is a number almost no angler can act on and the trend is what they fish by. With no previous trip: `1013 hPa. First trip logged here.` If the provider returns no pressure, the line is absent and is never faked.
3. **Air temperature, then sky and precipitation.** `14 °C (57 °F)`, then the condition text and its probability.

**Behind one `All conditions` disclosure, expanding in place:** humidity, UV index, cloud cover, feels-like, visibility, wind direction in degrees. Each renders only when it has a value.

**Sun and moon sit inside that disclosure and are computed locally**, not fetched: `Sunrise 06:18, sunset 18:52. Moon 78% waxing.` They need no provider and no key, and they are two of the three things an angler actually plans around.

**Tide is the third, and it is a data dependency rather than a promise.** Where a tide source covers the spot, the block prints `High 05:12, low 11:38` with its station and its datum named in the same container, because a tide prediction without its datum is a number with no reference frame. Where no source covers the spot, the line is absent and nothing is estimated in its place. This is the one field in the product whose absence is a coverage fact rather than a capture failure, and the provenance line says so: `No tide source covers this spot.`

**Below the numbers, the stamp**, which is what makes the block trustworthy:

> Forecast for a point 4.2 km from the pin, taken 18 minutes after the catch.

**And the attribution, in the same container**, unmodified, permanent, never in a tooltip, at 14px `--muted-foreground`, measured at 7.28:1 light and 6.12:1 dark against a record and comfortably above the 4.5:1 the platform policy requires:

> Source: Includes weather data from Google

That line is the smallest type in the product and it defines the entire 14px register. If it is the only 14px string on a screen, no decorative micro-label has anywhere to hide.

**Vocabulary is fixed product-wide.** The block is `Conditions`. The free-text field is `Summary`. The gust field is `Gusting to`. The current three-way split between `Weather snapshot`, `Conditions` and `Overview`, and between `Wind gust` and `Wind gusts`, ends. There is no weather glyph.

**The snapshot is never silently refetched**, and a refresh states what it will replace before it does it.

### Coordinates

- Five decimal places, about one metre. Never six, which claims a precision consumer GPS does not have.
- The accuracy radius is printed beside a fix whenever it is known: `-34.13291, 18.43056 ±8 m`.
- A position with no accuracy figure prints the source word instead of inventing a precision.
- Coordinates appear in exactly two places: the spot record, and the position block on a catch. Never in a corner as decoration, never in a URL query string, never in the feed post's visible text.
- Spot privacy is honoured before rendering. See section 12.

### Counts and plurals

- A real pluraliser, everywhere. `1 catch`, `12 catches`, `1 comment`, `3 likes`. The string `1 catches` does not exist.
- Zero is a sentence, not a digit. `No catches logged here yet.` A count of zero is never rendered as `0 comments`.
- Social counts read as one sentence beside the actions: `3 likes and 1 comment`. Not two icon-number chips.

### Missing values

**No em dash. No invented zero. No `N/A`. No `Unknown`.**

Five different absences are five different facts and they read differently:

| Situation | Renders |
|---|---|
| Length or weight never taken | `Not measured` |
| Species not entered | `Species not recorded` |
| The provider returned nothing for a field | `Not reported` |
| No spot chosen | `No spot recorded` |
| No coordinates on the record | `No position recorded` |

All at 16px in `--muted-foreground`, in the position the value would have occupied, each a tap target that fixes it where the angler owns the record.

**A field with no value is not rendered**, and if a section would then be empty, the section is not rendered. **One exception, and only one:** the measurements block on a catch detail always prints the labels the angler could have filled, with `Not measured`, because on a catch record the fact that a fish was not weighed is itself information.

**Never an invented zero.** The editor must never write `0` into a conditions field the API did not return. The current editor manufactures `0 °C`, `0%` and `0 km/h` and the detail page then displays them as readings.

### Personal and aggregate

Any figure that is the angler's own renders in `--foreground`. Any figure averaged across other anglers renders in `--muted-foreground`, same size, same position. A reader can never mistake somebody else's number for their own.

---

## 10. Motion

### Durations and easing

| Duration | Easing | What |
|---|---|---|
| 120ms | `cubic-bezier(0.2, 0, 0, 1)` | Control state changes: hover surface, pressed, toggle, disclosure arrow |
| 180ms | `cubic-bezier(0.2, 0, 0, 1)` in, `cubic-bezier(0.4, 0, 1, 1)` out | A panel expanding or collapsing in place |
| 220ms | the same pair | A bottom sheet or dialog entering or leaving |

Nothing exceeds 220ms. Nothing is slower on exit than on enter. Nothing is animated on any property other than `opacity`, `transform` and `background-color`.

### What moves, and why

1. **A bottom sheet travels from the bottom edge, 220ms.** It moves so that it is obvious where it came from and that dismissing sends it back there. It is the only thing in the product that travels.
2. **A row's hover surface fades in, 120ms**, opacity only, with the gutter permanently reserved so nothing reflows.
3. **A disclosure opens in place, 180ms.**

That is the complete list.

### What does not move

Page transitions. Navigation. Cards. Images. Loaders. Anything triggered by scroll. There is no fade-up on scroll, no reveal, no parallax, no marquee, no cursor follower, no hover lift, no dock magnification and no idle loop of any kind. The current dock's `hover:-translate-y-1 hover:scale-110` goes with the dock. `html { scroll-behavior: smooth }` is removed globally, because it currently animates browser scroll restoration on every Back.

Buttons get a real pressed state: the background steps one lightness increment over 120ms. No scale, no translate, no shadow.

**The newly saved row does not animate at all.** It carries a 2px `--success` left rule for four seconds and then loses it, so the angler can find it in a list of two hundred without reading. This is deliberately not a fade: a 900ms fade breaks the 220ms cap, and a state that is simply held and removed needs no reduced-motion fallback because it is the same in both modes.

### Reduced motion

Under `prefers-reduced-motion: reduce`, every duration becomes 1ms and the sheet arrives at its final position with an opacity change rather than a travel. Nothing is turned off into nothing: every piece of information a movement carried is still delivered, because the only three movements are a sheet, a hover wash and a disclosure, and all three survive as instant state changes.

### What replaces the bobbing loader

The bobber is deleted from the codebase along with its two infinite keyframes, its hard-coded `red-500`, `slate-500`, `white` and `sky-400` palette, its near-invisible white body on a near-white ground, its unfixed container height and its nine inconsistent labels.

- **Content-shaped skeletons.** A list renders the exact number of rows at the exact row height, each with a 56px `--muted` square and two `--muted` bars at the widths the title and sub-line will occupy. A detail page renders the photo frame at the record's stored aspect ratio, then the title bar, then the measurement rail. Content arrival causes zero layout shift.
- **Skeletons are static.** No shimmer, no pulse, no gradient sweep. A pulsing gradient is an idle animation with a job title, and on a dark screen at 05:00 it is the same offence as a float.
- **There is no spinner anywhere in this product.** An in-button busy state is the verb in progress plus a determinate 2px rule along the button's bottom edge: `Saving`, `Uploading photo 2 of 5`, `Locating`. Not `Saving...`, not `Getting current location...`, not `Uploading to R2...`.
- **Every skeleton times out at 5 seconds** and is replaced in place by an inline error with a `Try again` control. That closes the four surfaces that currently spin forever on a failed fetch.

---

## 11. Signature

## Provenance in words, never in a mark

**Every value in this product prints where it came from, in plain language, in the value's own string or on the line beneath it, at the same size as the value. The app's own readings print bare. Anything supplied by a person's judgement rather than by an instrument carries the word for it. Nothing in this product encodes reliability as a colour, a weight, a line, a dash, an icon, a badge or a symbol.**

The enforcing corollary, which is what makes it a system rule rather than a sentence:

**There is no legend anywhere in this product.** No key, no "solid means measured", no colour chart, no asterisk with a footnote. If a distinction cannot be said in a word on the line where it matters, this product does not make it. And no distinction whose misreading costs the angler anything is carried by a mark.

### What it looks like

```
Length        78 cm (30.7 in)
Weight        4.2 kg (9 lb 4 oz)   by eye
Caught        Tue 15 Sep, 06:42 SAST
Logged        21:15.
Position      -34.13291, 18.43056   placed by hand
Conditions    Forecast for a point 4.2 km from the pin, taken 18 minutes after the catch.
              Source: Includes weather data from Google
```

And where a record has nothing soft to say, one line closes it:

> Nothing on this record was estimated.

The provenance line is printed on **every** catch record, not only on soft ones. It is one sentence at 16px in `--muted-foreground`, and it names only the facts that are not firm. A record with nothing soft still prints its one line, so the signature is present on an angler's very first catch and on their two hundredth, which is the failure the measure line had.

### The job it does, that a plainer alternative cannot

A stranger opening a shared link reads `4.2 kg (9 lb 4 oz) by eye` and knows exactly what she is looking at, with no account, no legend and no prior exposure to this product. A reader who does not know the convention loses nothing, because `4.2 kg` read plainly still means 4.2 kg, and that is precisely what a typographic code cannot offer. The same word survives glare, polarised lenses, a wet screen, colour blindness, a screen reader and a screenshot pasted into WhatsApp.

Three seasons later it is the difference between a log you can compare against itself and a photo album with numbers on it.

### What contradicts it, and is therefore not in the system

- No second typeface, because a mono face in this product would exist to carry a code.
- No measure line, no confidence rule, no dashed rendering, no reliability badge, no confidence colour, no italic-for-uncertain, no opacity-for-uncertain, no asterisk.
- No tooltip that carries a fact not also on the page.
- No raw enum, no abbreviation the product has not spelled out, no `SSW`, no `MLLW`, no `FRESHWATER`.
- No icon standing in for a word.

---

## 12. Screens

One vocabulary throughout: a place you fish is a **spot**, a fish you logged is a **catch**, tackle is **gear**, a session is a **trip**, the weather stored on a catch is **conditions**. You **log** things that happened and you **add** things you keep. The current build's seven nouns for one concept end here, and the URL vocabulary (`/sites`, `/catches`, `/gear`) stays as it is because it is not user-facing copy.

So "spot detail" below is the surface today called site detail, and "My spots" is the surface today called My locations on desktop and Sites on mobile. That split between breakpoints is itself one of the bugs the rename closes.

### App shell and navigation

- **One layout route with an `<Outlet/>`, one auth guard, one header.** Thirteen pages stop mounting their own chrome. The floating pill dock, its magnification, its double tooltips, its duplicate `Plus` icons, its 96px in-flow spacer and the 150px of stacked top chrome are all deleted.
- **Mobile bottom bar: 56px plus `env(safe-area-inset-bottom)`, opaque `--background`, 1px top hairline.** Five word slots at 16px weight 520, no icons: `Feed · Catches · Spots · Gear · Log`. Each slot is at least 48px tall. `Log` is the last slot, a filled `--primary` block the full height of the bar and about 38% of its width, and it is the only filled control in the chrome. One profile switch mirrors the bar for a left-handed grip.
- **Desktop from 768px:** a single 64px header row inside the 1200px shell carrying the wordmark, the four destination words, the filled `Log a catch` control, then the avatar. It scrolls with the page. Nothing floats over content at any scroll position. The header and the content share one left edge.
- **Active state:** the nav word in `--foreground` at 520 with a 2px `--foreground` underline plus `aria-current="page"`, never colour alone. Prefix matching is fixed so `/catches/:id` and `/catches/:id/edit` both light `Catches`, which currently light nothing.
- **Signed out, the bar renders two words, `Feed` and `Sign in`.** `Catches`, `Spots`, `Gear` and `Log` do not exist for a visitor, so nobody is sent into a gated destination that renders blank.
- **Profile is reachable on every breakpoint** through the avatar in the header, which also holds `Activity`, the theme control and `Manage your account`. The dead hamburger is deleted rather than fixed.
- **`Activity` is one reverse-chronological list of likes, comments and follows**, each row a sentence with a link to the record it happened on, and an unread count on the avatar rendered as a number rather than a coloured dot. It is in-app only for this release; email comes later and is a setting, never a default.
- **Route mechanics:** scroll resets on navigation, focus moves to the new `<h1>`, `<main>` comes before the nav in the DOM with a skip link, both `<nav>` landmarks are labelled, and `document.title` is set per route from the record.
- **Toasts** sit at `bottom: calc(nav height + 16px)`, `inset-inline: 16px`, `max-width: 420px`, with `role="status"` on an outcome and `role="alert"` on a failure, a hard stack limit of three, pause on hover, and a queue cleared on route change so an error from the page you just left stops following you.

### Feed and post card

- **One column at every width, 720px.** The glass `rounded-2xl` panel wrapping the list is gone, so a post is no longer a card inside a card with two borders and two shadows.
- **A post is a surface, not a card:** `--card` ground, square corners, `--s-6` and a hairline between posts. No shadow, no radius, no nested Card.
- **Header row:** 40px avatar, display name at 16px weight 520, `@handle` in `--muted-foreground`, and one real sentence of context replacing the raw enum: `Caught at Kalk Bay · Tue 15 Sep, 06:42 · 4 h ago`. `CATCH • GLOBAL` is deleted.
- **Photo full bleed to the surface edges**, native ratio clamped between 16:9 and 4:5, swipe and arrow keys, wrapping at both ends, 48px arrows, and a `2 of 5` counter below the frame at 16px. The current build pads the media strip so photos stop 16px short of the edge.
- **Below the photo: the caption, then the measurement line with its source words.** `78 cm (30.7 in) · 4.2 kg (9 lb 4 oz) by eye`. This is the single biggest change to the feed, which currently says nothing at all about the fish.
- **Actions row:** `Like` and `Comment` as 48px text controls with `aria-pressed`, the liked state changing the word to `Liked`, and the counts as one sentence beside them: `3 likes and 1 comment`.
- **Everything links.** Author to the profile, title to the catch, spot name to the spot. The post is currently a dead end with three live destinations available.
- **Filters are two labelled radiogroups in the URL:** `Scope: Everywhere / Near me` and `Show: All / Catches / Spots`. Catch posts now carry coordinates, so `Near me` plus `Catches` returns results instead of being permanently empty. The radius slider gets an accessible name, a 1 km minimum, a 48px thumb and a live count: `Within 25 km. 14 posts.`
- **Like, comment and follow update optimistically and never refetch page one**, which currently discards every loaded page and jumps the scroll. Signing in refetches, so `Follow` stops appearing on the angler's own posts.
- **A post is a view of a record, not a copy of one.** Editing a catch updates its post, deleting a catch hides its post, and moving a spot's pin moves the post's position for `Near me`. The server currently only ever creates posts and never updates or hides them, so a deleted catch still shows in the feed with its title and its photos, and an edited caption stays stale forever.

### Catch detail

- **This is the record. Everything else in the product exists to make, find or share it.**
- **Mobile, one column:** photo, title block, measurements, conditions, gear, spot and map, notes, provenance line, actions. **Desktop from 1024px:** photo and notes in the 720px column with a 280px right rail carrying measurements, conditions, gear and spot, in the same reading order as mobile.
- **Photo at native ratio, capped at 70svh, `contain` on a `--muted` ground, square, no border, no shadow.** Gallery arrows 48px, a `2 of 6` counter, swipe, keyboard, wrapping. In dark it renders at `brightness(0.82)` until tapped. No text sits on it at any breakpoint.
- **Title and headline measurement are the same size**, 23px on mobile and 28px from 1024px, the title at 520 and the measurement at 620, one above the other. That equality is the page's whole argument, and the weight reserve is what makes the number the loud one.
- **Measurements are a hairline-divided rail, never stat tiles.** `Length`, `Weight`, and any of `Species`, `Count`, `Depth`, `Water temp` that were recorded, each with its source word, plus method and outcome as two plain words (`Lure` or `Bait` or `Fly`, and `Released` or `Kept`), neither of which is captured anywhere today and neither of which is ever guessed. An absent measurement prints `Not measured`. Nothing prints an em dash and nothing prints a zero.
- **Conditions:** the plain sentence, then wind, pressure-as-delta, temperature and sky, then `All conditions`, then the forecast stamp and the Google attribution line, all inside one container.
- **The map is a 3:2 frame** with the spot label outlined on the tiles, an `Open in Maps` link, `loading="lazy"` and `gestureHandling: cooperative` so it does not capture page scroll on a phone.
- **The catch is the social object, and the feed post is a view of it.** Likes and comments live on the catch, which is where the model already has `CatchLike`, `Comment`, `likeCount` and `commentCount` sitting unused while the UI likes a `FeedPost` instead. One object, one count, one thread, visible here and in the feed. Two parallel social models do not ship.
- **The provenance line closes the record**, above the actions. Owner controls (`Edit`, `Delete`) and `Share` sit at the end, after the record, not floating over it. The page currently has none of them and is a dead end for its own author.
- **Public, cached, and titled.** `document.title` is the catch. A missing catch renders the not-found screen rather than spinning forever. A stranger sees the identical record minus the owner controls.

### Log a catch, the fast path

- **One tap on `Log` from any screen.** The tap fires the position request, stamps the clock, starts the conditions pull and writes the record locally before the sheet has finished opening. Nothing is gated on a form loading, and nothing is lost if the app is killed.
- **A bottom sheet rises 220ms** over `--scrim`, `--popover` ground, 1px `--border`, no shadow. On desktop it is a centred 560px panel.
- **The capture receipt sits at the top of the sheet as a read-only block that updates in place:**
  ```
  Tue 15 Sep, 06:42 SAST
  -34.13291, 18.43056    ±34 m
  Conditions taken
  ```
  The accuracy figure counts down as the fix settles, inside a fixed-width right-aligned cell so the string never reflows. This is the one thing a spinner cannot tell an angler: whether a position actually landed before the fish goes back.
- **The 6 second ceiling.** With no fix after 6 seconds the line reads `Waiting for a fix` and Save stays enabled. The record saves with no position and the provenance line says so.
- **Three controls and a save, in this order:** `Take a photo` (48px, opening the camera directly), `Species` (a combobox over the angler's own previously used species, most recent first, free text accepted, blank allowed), one measurement pair with its unit chips and its `On a scale` control, and a `Save catch` bar pinned to the bottom edge of the sheet at 56px so it stays reachable with the keyboard up.
- **Nothing here can block a save.** No required field, no un-defaulted toggle, no `step`, no browser bubble. A measurement typed and left alone is recorded `by eye`.
- **Dismissing the sheet adds nothing and destroys nothing**, because the record already exists. That removes the lost-draft and orphaned-photo bugs at the architecture level rather than by adding a draft feature.
- **`Save catch` is disabled only while a photo is uploading**, with the reason beside it. Today a catch can be saved without the photo the angler just picked.
- **Two text controls in the sheet header:** `Nothing caught?` converts the same capture into a blank trip in one tap, keeping position, time and conditions and dropping the fish fields. `Add detail` opens the full path with everything preserved.

### Log a catch, the full path

- **Reached from the sheet or from `Add detail` on the saved record. The catch already exists, so this is editing.** That removes the double-submit window and the orphaned-spot bug in one move.
- **One column at 720px, four labelled groups separated by `--s-6` and a hairline, in the order an angler thinks:** The fish, Where, When and conditions, Gear and notes. Photos sit in The fish, not at the bottom.
- **The fish:** photos, species, length, weight, each with its unit chip and its instrument control, plus count, depth and water temperature folded into one `More` disclosure. Those three are stored by the model today and captured by nothing.
- **Where:** three explicit modes as a radiogroup with no drifting names. `The spot I am at` (the stamped fix, already selected, shown with its accuracy), `A saved spot` (a searchable combobox with real listbox semantics, nearest three first with distances, keyboard navigation, Escape to close, the selection marked) and `A new spot` (name plus map). `Use current location`, which currently means two different things on one screen and saves nothing in its dropdown form, is deleted as a phrase.
- **The map picker** centres on the stamped fix or on the device position when the angler presses the crosshair, never on the geographic centre of the United States at zoom 4. It never geolocates on mount, so no permission prompt fires without a user action. It carries a live coordinate readout, accepts a pasted Google Maps link using the parser that already exists in `lib/maps.ts` and is currently wired to nothing, never re-initialises on a parent re-render, and never coerces an empty coordinate to `0`. With no API key it shows two coordinate fields and the saved-spot list, not the name of an environment variable.
- **A new spot is created only on successful save of the catch, in one transaction.** The current flow creates the spot first, leaves Save enabled during that request, and a double tap produces duplicate spots and duplicate public feed posts.
- **When and conditions:** the caught-at field in local time with the zone named; the conditions block read-only on a `--muted` ground with no `--input` border so it cannot be mistaken for eight editable inputs; a `Conditions were taken 18 minutes after this time` line when the gap is material; and a real error state when the lookup fails instead of eight silent blanks and the literal words `Weather icon`.
- **Gear and notes:** gear filtered to the angler's own kit (the endpoint currently returns every user's), searchable across name, brand and type, with an `Add gear` link in the empty state. Method (`Lure`, `Bait`, `Fly`) and outcome (`Released`, `Kept`) sit here as two radiogroups with nothing preselected, because neither can be inferred and a wrong default would be a fact the record invented. Both are optional and neither can block a save. Notes with a live counter against the 2000 character server limit.
- **Validation is inline, beside the field, on blur, with focus moved to the first failure.** Toasts confirm outcomes only and never carry a validation message. A 400 from the server is mapped back to the field it names.

### Edit forms, catch, spot and gear

- **Edit is the same component as the full path**, prefilled. The systematic divergence ends: today Log catch has labels, a searchable spot picker with a map, a gear search, hidden number spinners and a submitting state, and Edit catch has none of the five.
- **Every field carries a visible `<label>` with `htmlFor`.** No form in this product is four unlabelled boxes. Placeholders are examples (`Kob`), never a repeat of the label.
- **Photos are editable after creation**, on catches and on spots, which is what makes `Open the catch to add them` a promise the product can keep.
- **The date field loads and saves in the same zone and round-trips exactly**, ending the bug where every save moves a Johannesburg catch two hours earlier.
- **Editing sends only changed fields.** Species id, count, depth, water temperature, humidity and UV stop being silently wiped by a form that never showed them, and `count` stops resetting to 1.
- **`Refresh conditions` states what it will do before it does it:** `This replaces the conditions saved at 06:42 with the conditions right now.` It uses the spot currently selected in the form, and a failed lookup leaves the stored snapshot untouched with the error beside the button, instead of clearing five fields under a success toast.
- **Water type offers the same four options in both forms:** `Fresh`, `Salt`, `Brackish`, `Other`. It is currently two on Log and four on Edit.
- **`Cancel` sits beside `Save changes`.** Leaving with unsaved changes asks. The post-save redirect uses `replace`, so Back does not return to the form. `Save` disables while submitting and shows the verb in progress.
- **`Delete` lives on the record it deletes**, behind one dialog pattern with an outline `--destructive` confirm, the name of the thing, a plain statement of the consequence, and a 10 second undo in the toast. `window.confirm` is removed from all three delete paths.

### Spot detail with map

- **Order: identity, position, catches, notes.** The map currently sits at the very bottom under ten catch rows and pagination, with no heading, which buries the page's main fact.
- **Identity:** 3:2 hero photo, name at 23px (28px from 1024px), then one line: `Saltwater · 43 catches logged here · best 91 cm kob`. Water type is a plain word, never `SALTWATER`, never colour-coded. Description and access notes both carry `white-space: pre-line`, which catch notes already do and these currently lose.
- **Position:** a real heading, the map at 3:2 (16:9 from 1024px) with `gestureHandling: cooperative`, our spot label outlined on the tiles, an `Open in Maps` link, and the coordinates printed beneath with their source word. One embed treatment product-wide replaces the three that exist today.
- **No coordinates does not mean no section.** A bordered `--muted` block reads `No position recorded for this spot.` with an `Add a position` control for the owner.
- **The delta block is the reason a spot exists as an entity.** `Now: south-west 24 km/h, 1013 hPa, down 6 since your last trip here.` Beneath it, a compact history of this angler's own logged trips here with their pressure and wind, which is what makes a pattern recoverable and is why blank trips matter.
- **Catches here:** the shared catch row, a real count in the heading (`Catches here (43)`), the author shown when it is not the viewer, and 48px pagination matching every other list. The heading no longer says `Recent catches at this site` over a paginated complete list.
- **Spot privacy lives here.** Three states on the owner's edit form: `Exact`, `About 1 km` and `Hidden`. A public surface renders the position at the chosen level and says which: `Position shown to about 1 km.` Every log today creates a public post with the exact pin.
- **Notes on the spot, which the model calls a review, are a rating and a paragraph, one per angler.** `Review` exists with a 1 to 5 rating and a body, `FishingSite.reviewCount` exists, and nothing in the product reads either. Here the summary is a sentence, not stars on a row: `Rated 4 out of 5 by 6 anglers.` The composer sits below the catches, the angler's own note is editable in place, and the rating is never rendered as a coloured badge or a five-glyph row.
- **`Save this spot` replaces the unused like.** `SiteLike` and `likeCount` exist with no UI anywhere. A like on a place is a meaningless gesture; saving one so it appears in your own spot list is the thing anglers actually want, so the same row in the database carries a control that says what it does. The count renders as a sentence: `Saved by 12 anglers.`
- **Owner controls at the end:** `Edit`, `Delete`, and a primary `Log a catch here` that pre-selects this spot. All twelve stored photos are reachable, not only the first.

### My catches

- **A chronological log, not a wall of bordered cards.** `<h1>My catches` with a real count beside it: `184 catches, 22 blank trips`.
- **One shared catch row**, used here, on the spot page, in search results and on a profile, replacing the four different anatomies a catch currently has. 56px square thumbnail or the diagonal tile, title at 19px weight 520, a 16px `--muted-foreground` sub-line `Kob · Tue 15 Sep, 06:42 · Kalk Bay`, then right-aligned fixed-width measurement cells at `--w-length` and `--w-weight` carrying the paired values and their source words, then the date cell.
- **Rows have no chrome until pointed at.** No border, no card, no shadow. A hairline divides them, an `--accent` surface fades in on hover and focus at 120ms with the gutter permanently reserved, and the whole row is the link. Long titles truncate so the cells stay aligned.
- **Blank trips appear in the same list**, as quieter rows with no thumbnail and no measurement cells: `Blank · Tue 8 Sep, 05:20 · Kalk Bay` with the conditions beside them. They are what make the catch rows mean something.
- **Incomplete captures sit at the top, above a rule**, with one line saying what is missing: `Logged 06:42, no species yet.` Tapping reopens the sheet. This is the bridge between the fast path and a finished record.
- **`Edit` and `Delete` are not on the row.** They live on the record, which removes a solid red destructive control from every one of 184 rows the angler scrolls daily.
- **Empty state carries the action:** `No catches yet. Log the first one and it will show here.` plus the control. A no-match state is a different string with `Clear filters`.

### My spots

- **Same row grammar as My catches**, which is the point: one list component, one set of behaviours, four routes. 56px photo, name at 19px, a 16px sub-line `Saltwater · 43 catches · last fished 8 Sep`, then a right-aligned cell carrying the best fish recorded there and, when location is available, the distance from the angler's current position.
- **`<h1>My spots` and, beside it, `Add a spot`.** Its absence today, combined with the missing bar entry, makes creating a spot impossible on a phone.
- **A `List` and `Map` toggle**, remembered per angler. The list is the default; the map plots this angler's own spots with `--primary` pins, which is the second of the three jobs the accent is allowed.
- **The map view is the whole log on one map**, not one spot at a time: every spot the angler has, plus every catch that carries its own coordinates, with the spot pins clickable through to their records. A map that shows one place at a time cannot answer the question a map is for, which is where these places are relative to each other and to you. Spots saved from other anglers render in `--muted-foreground`, so a borrowed place is never mistaken for your own.
- **Sorted by last fished by default**, not by creation date, with `Most catches`, `Nearest` and `A to Z` offered.
- **Two unphotographed spots are still distinguishable**, because water type, catch count and last-fished date are all on the row.
- **Deleting a spot names what happens to the catches logged there before it asks.**
- **Empty state:** `No spots yet. Add the places you fish and your catches will group under them.` plus the control.

### Gear locker and gear detail

- **Grouped by type, not a flat list:** `Rods`, `Reels`, `Lures`, `Baits`, `Lines`, `Hooks`, `Weights`, each a 19px section heading with a count. That replaces a single unsorted run of identical rows with no way to scan by category, and it does the categorisation job with words rather than with seven invented tackle glyphs.
- **Row:** 56px photo on a `--muted` ground with `object-fit: contain` so a rod on a table is not chopped, name at 19px weight 520, `Shimano · Reel` at 16px `--muted-foreground`. Type is sentence case everywhere, ending the forms-say-`Reel`, lists-say-`reel` split.
- **`Add gear` beside the `<h1>`, plus the bar entry**, so gear can be created on a phone, which it currently cannot be on any breakpoint.
- **Gear detail is a route that does not exist today:** the photo at 3:2 contain, the fields, `Edit`, `Delete`, and the list of catches taken on it with a summary line: `14 catches, best 3.1 kg`. That list is the only reason to keep a gear locker.
- **Delete names the real consequence**, because the server hard-deletes and detaches the item from every catch that used it.
- **Rows with no photo get the diagonal tile at 56px**, so text never shifts left and misaligns with photo rows.
- **Empty state per group and for the whole locker**, each carrying `Add gear`.

### Profile and public profile

- **One component, two states.** `/u/:username` is a real route, so a name in a followers list and an author in the feed both lead somewhere. Today neither does.
- **Top block:** 64px avatar, display name at 23px weight 520, `@handle` at 16px `--muted-foreground`, bio at 16px on a 68ch measure, and `Fishing since Mar 2025`. **Display name, handle and bio render as text**, not only as the contents of form inputs, which is how the current page hides them.
- **Figures as sentences, never as stat tiles:** `184 catches at 18 spots.` `48 followers, following 31.` Followers and following are the two links into the dialog. No big-number dashboard.
- **Personal bests as a short block of sentences:** `Best garrick 6.1 kg (13 lb 7 oz), Kalk Bay, 12 Mar.` Longest, heaviest and best-by-species, each a link to its record. On a public profile it reads `Owen's best garrick`, so a stranger has the standing to read it.
- **Gallery:** `repeat(auto-fill, minmax(128px, 1fr))` of 1:1 tiles, each linking to its record, with `See all`. Currently capped at twelve, catches first, unlinked, and badged with the raw enum.
- **Settings live on a separate route**, `/profile/settings`, so the read view is a body of work and the edit view is a form. Saving returns to the profile and says what changed. It currently redirects to the marketing home page, so the angler never sees the result.
- **Settings form:** visible labels, helper text stating the real rules (`3 to 40 characters, letters, numbers and underscore`), a live counter on bio against the 280 limit, and field-level errors including a distinct message for a taken handle. One secondary control beneath, `Manage your account`. The internal database `User ID`, the `Last profile update` timestamp, the storage-mode language and every mention of the auth vendor disappear from the interface.
- **Two switches live here** and nowhere else: `Log button on the left` for a left-handed grip, and `I usually weigh on a scale` and `I usually measure on a tape`, which set the default source for new measurements.

### Followers and following

- **A bottom sheet on mobile at full width with `--gutter` side margins, a centred 480px dialog from 640px**, `max-height: 72vh` with internal scroll. It currently touches both screen edges on a phone.
- **A count in the title** and a labelled search field debounced at 250ms. The list is not replaced by the word `Loading...` on every keystroke.
- **Rows are 48px and link to the profile**, each carrying a `Follow` or `Following` control that can be acted on without leaving the dialog. Today the rows lead nowhere.
- **The list is cleared on close**, so opening Following after Followers does not flash the previous rows for a frame.
- **Unfollow asks once, in the same dialog pattern as every other confirmation**, and names the consequence without inventing a fact about the person.
- **Empty states differ:** `No followers yet.` is not the same sentence as `No one matches "pieter".`

### Image upload

- **One control, one behaviour, every scope.** Not a card inside a card. A 96px full-width block with a solid 1px `--input` boundary reading `Add photos`, with `JPG, PNG or WebP, up to 10 MB each.` at 14px beneath it, sitting above the grid of tiles it has already produced.
- **No dashed border anywhere**, because the current dashed tile implies drag and drop and there is no drop handler in the codebase.
- **It actually accepts drops on desktop** (`dragover` swaps the boundary to `--ring`) and accepts paste. On mobile `Take a photo` opens the camera directly with `capture="environment"` and `Choose photos` opens the library.
- **`multiple` is set wherever the scope allows more than one.** The catch picker currently advertises 8 photos with no `multiple` attribute, so eight photos take eight trips through the OS dialog, and the spot picker advertises 12 while being single-image by accident.
- **A live count beside the label:** `3 of 8`. At the limit the control disables and reads `8 of 8. Remove one to add another.` rather than firing an error toast.
- **Per-file progress is a determinate 2px rule along the bottom of that file's tile**, with its own retry and its own remove. Never one shared indicator for a queue, never a vendor name, never a bobber.
- **Tiles are 4:3 on a `--muted` ground with a 48px `X` in the corner.** The first tile carries a `Cover` marker, any tile can be made the cover, and tiles reorder by drag on desktop and by a `Move up` control on touch.
- **Single-image scopes replace in place.** Choosing a new avatar or gear photo swaps it, instead of refusing with `Only one image is allowed here.` on a control literally labelled `Replace image`. The avatar preview is circular, matching where it will appear.
- **Errors are inline under the grid**, naming the file and the fix, never split between inline red text and a corner toast for the same class of problem. The parent form's Save disables while any upload is in flight and says why.

### Species picker

- **Species is a real field on every catch form, not a word buried in the title.** The model already has `Species` with `commonName`, `scientificName`, `aliases` and `regionTags`, and no surface uses it, which is why catch detail prints `Species: Not specified`.
- **A searchable combobox with full listbox semantics:** arrow keys, Escape to close, type-ahead, the selection marked, and a visible label.
- **The angler's own recent species come first**, unsorted alphabetically, because a repeat is one tap and repeats are most of a log.
- **Search matches common name, alias and scientific name**, so `garrick`, `leervis` and `Lichia amia` all find the same fish. Regional names are the point: this audience says `kob` and `daga`, not `croaker`.
- **`Not sure` is always an available choice** and is a stored value distinct from empty. A record with it prints `Species not recorded` and offers the field as a tap target that fixes it later.
- **Free text is accepted** and is stored as typed until it is matched, because refusing an unknown fish at 06:42 is worse than storing a string.
- **The scientific name renders in italic** and only on the catch detail, where there is room. It is the only italic in the product.

### Sessions, which the product calls trips

- **A trip is opened by the first log of the day at a spot, and later logs within six hours at the same spot attach to it.** No new gesture, no new button.
- **A trip holds the position, the time span and one conditions snapshot**, and zero or more catches. `Tue 15 Sep, 05:40 to 09:15, Kalk Bay. 3 catches.`
- **A trip with no fish is a record, not an absence.** `Nothing caught?` on the fast path writes one in a single tap, and the trip page reads `No catches. South-west 24 km/h, 1013 hPa, overcast.`
- **Blank trips are what make the conditions data worth anything**, because conditions for successes only cannot be compared against anything.
- **My catches groups by trip where a trip has more than one catch**, under one header row, and the feed posts one entry per trip rather than one per fish, which is what stops the feed repeating the same spot six times.
- **The spot page's history is a list of trips**, with their pressure and wind, which is the pattern an angler is actually looking for.
- **A trip is editable and deletable from its own page**, and deleting one asks what happens to the catches inside it.

### Personal bests

- **Derived from the log, never entered.** Best by species, longest, heaviest, and most in one trip.
- **Stated in words, on the record:** `Your best garrick.` on the owner's view, `Owen's best garrick.` on a public view, at 16px in `--muted-foreground`, beneath the measurement it refers to.
- **Never a bar, never a tick, never a trophy, never a badge, never a confetti burst and never a congratulatory toast.** A measure line comparing a value to a threshold is a bar chart with a marker, which is the most default object available for that job.
- **Never carried by an emphasis rule across a list.** Rendering 211 of 212 weights muted so one can be loud makes the data the list exists to show into the quiet thing.
- **A personal best block on the profile**, one sentence per record, each linking to its catch.
- **No baseline is not a failure state.** With fewer than three records for a species the block simply does not mention that species. There is no `no baseline yet` caption and no empty outline.
- **Nothing is ever compared against other anglers.** An angler compares a fish to their own best, which is the threshold they own.

### Search and filter

- **Filters live in the URL on every list**, so a filtered view is bookmarkable, sharable and survives Back. Today nothing is in the URL and every filter resets.
- **One search field pattern:** `type="search"`, a visible `<label>`, a clear control, 200ms debounce, at least 48px tall, no leading icon.
- **My catches filters on spot, species, gear, month and season**, and sorts by date caught, length or weight. My spots filters on water type and sorts by last fished, catch count or distance. Gear filters by type.
- **Filter chips are 4px rectangles with `aria-pressed`**, never pills, and each carries its own count.
- **Search matches what an angler would type:** species and its aliases, catch title, spot name, gear name and brand. The matched substring renders at weight 520 in the result.
- **A search with no matches is a different state from an empty list**, with a different sentence and a `Clear search` control.
- **Results use the shared catch row**, so a search result looks like the list it came from.

### Sharing a catch card

- **`Share` sits at the end of a catch record, beside the owner controls.**
- **The primary share is the link**, because the record renders correctly signed out, in both unit systems, with its provenance intact. `document.title` and the Open Graph image are built from the record, so a pasted link previews as the catch rather than as `client`.
- **The image card is generated server-side at 1080 by 1350** for WhatsApp and Instagram, which is where this actually happens: the photograph at its native ratio on `--muted`, the species and the paired measurements with their source words, the spot name at the spot's chosen privacy level, and the date.
- **The card carries the same provenance the record does.** A `by eye` weight says `by eye` on the card. A card that quietly drops the source word would undo the one rule the product has.
- **Spot privacy is applied before the card is drawn.** A hidden spot prints no place name and no coordinates, and the card says `Spot not shown`.
- **No watermark, no frame, no border, no logo lockup and no QR code.** The wordmark sits once, small, at the foot.
- **A preview is shown before anything is shared**, with one control to include or omit the spot name for that share only.

### Empty, loading and error states

- **Every empty state carries the next action.** One sentence naming what is missing, one saying how it gets filled, and a real control. The nine empty strings currently in the product are all dead ends.
- **Empty and no-match are different states** with different copy and different controls. The current build uses one string for both in all three lists.
- **Loading is a content-shaped static skeleton** at the real geometry, with the correct number of rows at the correct height. Never a spinner, never a bobber, never plain text, never `(loading...)` inside a legend.
- **Every skeleton times out at 5 seconds** into an inline error with `Try again`. Nothing in this product spins forever, which four surfaces currently do.
- **Errors are inline and in place**, replacing the thing that failed, with the cause in plain language and one action. A toast reports the outcome of an action the angler cannot see; it never carries a validation message and never carries the only copy of an error.
- **Signed out on a private list:** the page renders its own chrome and one block, `Sign in to see your catches.`, with the sign-in control. Not a blank page behind chrome that fires an error toast.
- **Auth changes refetch.** Signing in from the header fills the list you are looking at instead of leaving `No catches found.` on screen until a manual reload.
- **Offline is a first-class state.** A persistent 48px `--warning` bar above the bar reads `Offline. Catches you log are saved on this device and will upload when you have signal.` at 8.57:1 in dark and 5.49:1 in light, and the header carries the queue count: `1 catch waiting to sync`. The fast path writes locally first, so the 06:41 catch survives no signal, which is the single most likely condition it will meet.
- **A partial capture is kept and named.** Whatever landed is kept, what did not land is absent rather than zeroed, and the record says `Saved. No conditions taken.`
- **Onboarding is the empty states and nothing else.** There is no tour, no carousel, no checklist and no modal on first run. A new angler lands on an empty catch list carrying one sentence and the `Log a catch` control, and the first record teaches the product by being one. The first catch's provenance line is the only place the product explains itself, and it does so about that angler's own fish.

### Not found

- **A real screen at `*`, and at any deleted or missing record.** The current `*` route silently redirects to the marketing page, so a broken catch link reads as being logged out.
- **One sentence naming what is not there:** `That catch is not here. It may have been deleted.` Different sentences for a catch, a spot, a gear item and an unknown URL.
- **One route out**, to the list the record would have belonged to, plus the nav the angler already has.
- **`document.title` says so**, and the response is a real 404 for a crawler rather than a 200 with a redirect.
- **A deleted record inside its 10 second undo window** says `This catch was deleted. You can still undo it from the toast.` while the toast is alive.
- **No illustration, no large numeral, no joke.**

### Signed-out landing page

- **A signed-in angler never sees this page.** `/` becomes their catch list. The current build serves an identical marketing page with `Get early access` to an angler with 184 catches.
- **Band 1, the claim.** Left-aligned, not a centred hero with two symmetrical CTAs. The wordmark, one `h1` at 40px, one sentence at 16px on a 60ch measure, one filled `Create an account` and one text `See a real record` beside it. To the right, one real catch photograph at native ratio, full bleed to the viewport edge, not in a rounded frame and not floating on a glow.
- **Band 2, the record.** A genuine catch record at full production fidelity: photograph, title and headline measurement at the same size, the measurements with their source words, the conditions with their interpretation sentence and their Google attribution line, the spot with its map, and the provenance line. The product demonstrating itself is the only honest proof available before launch.
- **Band 3, density.** The same record again as one row inside a list of twelve, with one caption above it, so a visitor sees what 184 catches will look like. Showing what the product looks like full sells the log, which no single hero record can.
- **Band 4, questions.** A definition list with real `<h3>` elements, five questions an angler would actually ask: does it work without signal, who can see my spots, what happens to my photos, can I get my data out, what does it cost. Not cards, not an accordion, not a grid, and not the three internal design-review questions currently shipped.
- **Every fabricated number and placeholder is deleted:** `1,200+`, `4,800+`, `12k+`, `Hero illustration slot`, `Illustration slot A`, `Illustration slot B`, `Live activity panel`, `Inspired by modern UI libraries`, and the two named features the product does not have.
- **The app navigation does not render here**, and the marketing anchors do not render on app pages. Today both are true in both directions, and the anchors are plain `<a href="/#...">` that full-reload out of the app.
- **Footer:** the wordmark, a real contact address, and Privacy and Terms as real routes. `href="#"` does not ship, and Contact does not scroll to an FAQ containing no contact details.
- **Meta layer complete:** a `<title>` under 60 characters, a meta description, `theme-color` for both themes, an Open Graph image at 1200 by 630 built from a real record, a favicon set, a web manifest, and `scroll-margin-top: 72px` on every anchor target.

---

## 13. Copy voice

### Five rules

1. **Say what happened to the record, and name it.** Every message names the thing and its state. `Catch saved.` `Catch not saved.` `That photo did not upload.` No product voice, no cheer, no exclamation marks, no personality in a system message.
2. **Name the field, not the form.** An error says which value is wrong and what would make it right, and it appears beside that value. `Check your values and try again.` is not an error message.
3. **One word per concept, product-wide.** A place you fish is a **spot**. A fish you logged is a **catch**. Tackle is **gear**. A session is a **trip**. The weather stored on a catch is **conditions**. You **log** what happened and you **add** what you keep, so it is `Log a catch` and `Add a spot`. Never a second word for the same thing.
4. **No em dashes, no semicolons, no three-part lists, no "whether you are X or Y", no "not just X but Y".** Sentences end with a full stop. Two short sentences beat one nested one. No SaaS verbs, no `unlock`, `elevate`, `seamless`, `effortless`, `discover`, `curated`, `crafted` or `journey`.
5. **Never claim a number the product has not earned, and never hide one it has.** No user counts, no ratings, no social proof, no invented totals. Conversely, if the app knows the GPS accuracy, the forecast distance or the snapshot lag, it prints them. Nothing from the stack reaches a person: no R2, no Clerk, no environment variables, no enum values, no database IDs, no MIME types.

### Rewrites

| Original, as it ships today | New |
|---|---|
| `Plan, log, and relive your best fishing days with a premium UI.` | `A record of every fish you have caught, and the conditions that were there when you caught it.` |
| `We redesigned the landing experience with richer color, glassy surfaces, and modular sections ready for your illustrations, product renders, and future marketing assets.` | `One tap saves the place, the minute and the weather. The rest can wait until you are dry.` |
| `Get early access` | `Create an account` |
| `View product tour` | `See a real record` |
| `Inspired by modern UI libraries` | (deleted) |
| `Catch logged!` | `Catch saved. 78 cm, 06:42, Kalk Bay.` |
| `Fishing site logged!` | `Spot saved. No catches here yet.` |
| `Gear saved` | `Gear saved. Shimano Stradic.` |
| `Your catch was saved. You can add images later while we improve upload reliability.` | `Catch saved without the photos. Open the catch to add them.` |
| `Unable to log catch` with `Check your values and try again.` | `Not saved. The title needs at least 2 characters.` beside the title field, not in a toast |
| `Uploading to R2...` | `Uploading photo 2 of 5` |
| `Could not upload image to Cloudflare R2.` | `That photo did not upload. Tap to try again.` |
| `Image upload complete.` | `5 photos added.` |
| `Accepted: image/jpeg, image/png, image/webp • Max size: 10MB` | `JPG, PNG or WebP, up to 10 MB each.` |
| `Maximum 1 images allowed.` | `One photo per gear item. Remove the current one first.` |
| `Only one image is allowed here.` with `Remove the current image to upload a new one.` | `Replaced.` (the new photo simply replaces the old one) |
| `Image keeps its original framing.` | `The whole photo is kept.` |
| `Select image` | `Add photos` |
| `Google Map could not load. Set VITE_GOOGLE_MAPS_API_KEY to use the draggable pin map.` | `The map is not loading. You can type the coordinates below, or pick a spot you have already saved.` |
| `Weather fields are cleared for custom locations without coordinates.` | `Drop a pin and the conditions at that spot are saved with the catch.` |
| `Use current location` | `The spot I am at` |
| `Other (add new spot)` and `Other (create new location)` and `New location name` | `A new spot` and `Name this spot` |
| `Enter fishing spot name` | `Kalk Bay` (a placeholder that is an example, not a repeat of the label) |
| `No fishing spot selected` | `No spot recorded` |
| `My locations`, `Sites`, `fishing spot`, `location`, `site images` | `Spots` everywhere, and `Your photos` for the last one |
| `1 catches • 9/15/2026, 6:42:13 AM • Blue Lake` | `Kob · Tue 15 Sep, 06:42 · Blue Lake` |
| `CATCH • GLOBAL` | `Caught at Blue Lake · Tue 15 Sep, 06:42 · 4 h ago` |
| `Species: Not specified` | `Species not recorded` |
| `Unknown species` | `Species not recorded` |
| `Water type: FRESHWATER` | `Freshwater` |
| `Recent catches at this site` | `Catches here (43)` |
| `—` as the value for a missing length or weight | `Not measured` |
| `No text` | (nothing is rendered) |
| `No img`, `No image`, `No image yet`, `No images uploaded` | (nothing is rendered; the diagonal tile holds the space, `alt=""`) |
| `Weather icon` | (nothing is rendered; there is no weather glyph) |
| `No catches found.` used for an empty list | `No catches yet. Log the first one and it will show here.` |
| `No catches found.` used for a filtered list | `No catches match "blue".` with `Clear search` |
| `No locations found.` | `No spots yet. Add the places you fish and your catches will group under them.` |
| `No gear found in the database yet.` | `No gear yet. Add a rod or a lure and it will show here.` |
| `No posts found inside this radius yet.` | `Nothing logged within 25 km in the last 30 days. Try a wider radius.` |
| `You reached the end of the feed.` | `That is everything from the last 30 days.` |
| `Loading feed...` and `Loading your fishing spots and gear...` and `(loading...)` | (a skeleton at the real geometry, no text) |
| `Getting current location...` and `Detecting location...` and `Loading conditions...` | `Locating` and `Taking conditions` |
| `Unable to load your sites` | `Could not load your spots.` with a `Try again` control in place of the list |
| `Unable to load fishing spots` | `Could not load your spots. You can still save this catch without one.` |
| `Do you want to unfollow @{username}?` | `Stop following @{username}? Their catches leave your feed.` |
| `Delete this catch?` (browser confirm) | `Delete this catch? It leaves your log and your feed. You can undo for 10 seconds.` |
| `Delete this gear item?` (browser confirm) | `Delete this reel? It will be removed from the 14 catches that used it.` |
| `Sign in to log a catch.` | `Sign in to save this catch. Nothing you have entered is lost.` |
| `Your catches & site images` | `Your photos` |
| `Save app profile` | `Save changes` |
| `Manage account / delete in Clerk` | `Manage your account` |
| `Profile saved to database` and `Saved to Clerk fallback profile` | `Profile saved.` |
| `Manage the account fields saved in your app database.` | (deleted; the section heading is `Settings`) |
| `Signed in as {email}` with `User ID: {id}` | `Signed in as {email}` (the ID leaves the interface) |
| `Open navigation menu` | (deleted; the control is deleted with it) |
| `Something went wrong. Please try again.` | (deleted with the chat components) |
| `Can we swap in real illustrations later?` | `Does it work without signal?` |
| `Is the layout still easy to scale?` | `Who can see my spots?` |
| `Does this visual design support both dark and light mode?` | `What happens to my photos?` |
| `Frequently asked questions` | `Questions` |
| `© {year} Fullstack AI Angler. Designed for modern outdoor products.` | `© {year} {name}.` with real Privacy, Terms and contact links beside it |

---

## 14. Refusals

### First-order tells, removed from the current build

Glassmorphism and every `backdrop-filter`. The blue to teal palette and the sky radial glow. Coloured glow shadows (`shadow-primary/30`, `shadow-lg shadow-primary/35`). The lucide `Fish` in a tinted rounded square. `rounded-xl` cards with soft shadows around everything, card inside card, and walls of identical cards. A lucide icon on every label. The macOS dock with hover magnification, lift and double tooltips. The perpetually bobbing bobber and its two infinite keyframes. The dashed dropzone that accepts no drops. Untouched shadcn defaults, the `new-york` neutral ramp, `--radius: 0.625rem`, the seven-step radius scale, and the unused `chart-*` and `sidebar-*` tokens. Dark mode as the light palette with lightness flipped. The three shipped illustration-slot placeholders. `plan, log, and relive`. `Catch logged!`. Em dashes as missing values. `R2`, `Cloudflare R2`, `VITE_GOOGLE_MAPS_API_KEY`, `CATCH • GLOBAL`, `FRESHWATER`, `User ID`, raw MIME types. `No text` and `No img`. The centred hero with two dead CTAs. `1,200+`, `4,800+`, `12k+`. The three-card feature row and the four-card feature grid.

### Second-order tells, which this premise would produce by default

"A record that says which of its own numbers to trust" is one short step from a specimen-label pastiche. Each of these is banned by rule, not by taste.

- **No parchment, cream, bone or ledger-paper canvas.** Both neutral ramps are chroma exactly 0.000, and the stated job for that is photograph fidelity, which is testable.
- **No rust, burnt orange or ochre accent.** The accent is berry magenta at h 328, chosen because two of its three permitted uses sit on imagery this product does not draw.
- **No editorial serif.** No Fraunces, Instrument Serif, Playfair, DM Serif, Cormorant or EB Garamond, and no italic word in a headline. There is one family and it is not a serif. The one italic in the product is a Latin binomial.
- **No monospace at all**, as ornament or otherwise. Both jobs a mono would have done were checked at source and both are gone.
- **No uppercase, and no positive tracking token.** Wide-tracked micro-labels, numbered eyebrows like `01 / CATCHES` and pill badges are not expressible in this system.
- **No coordinates or timestamps sprinkled in corners.** A coordinate appears in two places and both are the record stating a fact about itself.
- **No film grain, noise, paper texture, halftone, torn edge, tape, rubber stamp, `Est.` crest or vintage badge.** No texture of any kind.
- **No topographic contours, sonar rings, bathymetry, depth soundings, compass roses or map grids as decoration.** The only map is a real map showing a real position. Chart No. 1 contributes two data mechanisms here and zero graphics.
- **No chartplotter skin.** No instrument panel, no gauge face, no bezel, no needle, no sweep arc. The Garmin reference earns its place through the capture-before-confirmation mechanism and nothing else.
- **No brass, no dial, no Fair and Change and Stormy arc.** The barometer contributes the delta.
- **No forest green plus khaki plus sand.** No Patagonia or Filson pastiche.
- **No line-art fish, hook logo or wave glyph.** There are no illustrations at all, and the wordmark is a name in the product's own type.
- **No bento grid and no big-number stat dashboard.** A profile's figures are sentences.
- **No hairline Swiss grid pastiche with index numbers in the margins.**
- **No pure-black dark mode with a neon accent.** Dark is L 0.185 neutral with peak text luminance capped at 0.493, and the accent is a de-chromatised berry at 6.07:1 on its own fill.
- **No `Field Notes`, `Logbook`, `Tight Lines`, `the modern angler's journal`, `crafted for anglers who` or `every cast tells a story`.** No aphorism-only copy anywhere. The product has no name yet and this document does not invent one.
- **No fade-up on scroll, no marquee, no cursor follower, no scroll-triggered anything.** Three things move and they are enumerated in section 10.
- **No serif plus sans plus mono stack.** One family, two files.

### Refusals this system could have had for free

- **No `box-shadow`, anywhere, in either theme.** Zero declarations, grep-auditable.
- **No icon beside any text label.** Six glyphs in the whole product, in two permitted situations.
- **No `rounded-lg`, `xl`, `2xl` or `3xl`, and no `rounded-full` except an avatar.** Two radii and the corner is an affordance.
- **No dashed border in any state.**
- **No teal, blue, cyan or aqua anywhere in the interface.** They belong to the water in the photographs.
- **No `--accent` as a colour.** It is a lightness step, so nothing flashes teal on hover.
- **No colour-only state.** Liked, active, selected, error and provenance each carry a second, non-chromatic signal.
- **No hidden units.** Every number prints its unit, every time, in both systems, on the record itself.
- **No spinner.** There is no indeterminate loading indicator in this product.
- **No legend, no key, no tooltip carrying a fact that is not also on the page.**

### One refusal specific to this product

**No AI surface in this release.** The dormant `ChatBot`, `ChatInput`, `ChatMessages` and `TypingIndicator` components come out of the client. The live `POST /api/chat` endpoint, which today calls a paid model behind no interface at all, is switched off or left with no front door and no promise pointing at it. The placeholder product name with "AI" in it, and the landing page's "smart insights", go with them.

The argument is Spec Block's and it is the sharpest paragraph in the three documents: a tool whose whole claim is that it does not invent numbers cannot lead with a feature whose failure mode is inventing them. When a question-answering surface does ship, it belongs inside the record as a search over the angler's own log, and its answers carry the same provenance line as every other value in this product. That is also where the system already has a place for it, because "where did this number come from" is the one question the whole product is built to answer.
