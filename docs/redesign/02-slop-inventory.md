# Appendix B. Slop inventory of the current build (file:line)

## ../index.html
- :7 Vite starter template leftovers never replaced. Evidence: `<title>client</title>` and favicon `/vite.svg` (line 5); App.css lines 1-42 are the Vite starter styles (`.logo` spin, `.read-the-docs { color: #888 }`) and are imported nowhere

## components/ChatInput.tsx
- :32 Stock ChatGPT-clone chat UI. Evidence: `border-2 p-4 rounded-3xl` composer, placeholder 'Ask anything' (41), round `rounded-full w-9 h-9` send button with FaArrowUp (44-48); bubbles `bg-blue-600 text-white` vs `bg-gray-200 text-black` (ChatMessages.tsx:32)

## components/ChatMessages.tsx
- :32 Hard-coded Tailwind demo colours that bypass theme tokens and dark mode. Evidence: `bg-blue-600`, `bg-gray-200 text-black`; TypingIndicator.tsx:3,16 `bg-gray-200`, `bg-gray-800`; ChatBot.tsx:62-64 `border-red-300 bg-red-100 text-red-500`; ImageUploader.tsx:145 `text-red-500`

## components/ImageUploader.tsx
- :132 Generic dashed upload tile that looks like a dropzone but does not accept drops. Evidence: `rounded-xl border-dashed border-border/80 bg-muted/40 px-4 py-6` with centered ImagePlus icon and 'Select image'; no onDrop/onDragOver anywhere in the file

## components/fishing/FishingActionBar.tsx
- :14 Lucide icon on every nav label, with a duplicated glyph for different actions. Evidence: `Plus` used for both `Log catch` (line 14) and `Add gear` (line 18); every item in both arrays carries an icon
- :27 Glassmorphism navigation dock with an oversized soft shadow. Evidence: `rounded-full border border-border/70 bg-background/95 ... shadow-[0_8px_30px_rgb(0_0_0_/_0.12)] backdrop-blur` floating pill; the mobile bar repeats `bg-background/95 ... backdrop-blur` at line 54
- :34 Floating frosted pill dock with macOS-style hover magnify, a decorative motion flourish. Evidence: rounded-full border border-border/70 bg-background/95 ... shadow-[0_8px_30px_rgb(0_0_0_/_0.12)] backdrop-blur (27) and hover:-translate-y-1 hover:scale-110 focus-visible:scale-110 (34)
- :54 Translucent blurred mobile bottom bar. Evidence: border-t border-border/70 bg-background/95 ... backdrop-blur md:hidden

## components/landing/LandingFaq.tsx
- :7 FAQ is developer or design-review Q&A, not user questions. Evidence: "Can we swap in real illustrations later?", "Does this visual design support both dark and light mode?" (:12), "Is the layout still easy to scale?" (:17); intro :38 "Built to feel like a polished SaaS landing page"
- :45 Walls of identical default shadcn cards with primary-tinted borders. Evidence: Card className="border-primary/15" repeated three times; the same Card rounded-xl border py-6 shadow-sm (ui/card.tsx:10) is used for 3 stat, 4 feature and 2 use-case cards with border-primary/10, /15 and /20 variants

## components/landing/LandingFeatures.tsx
- :18 Rainbow per-card gradient washes, including blue-to-teal and purple. Evidence: tone 'from-sky-500/20 to-cyan-400/10', 'from-emerald-500/20 to-lime-400/10' (:25), 'from-indigo-500/20 to-violet-400/10' (:32), 'from-fuchsia-500/20 to-rose-400/10' (:39)
- :49 Section heading and intro describe the landing page rather than the product. Evidence: h2 "A landing page designed like a modern product showcase"; :52 "reusable content blocks inspired by premium component systems"
- :64 Hover animation on cards that are not interactive. Evidence: absolute gradient layer opacity-60 transition-opacity group-hover:opacity-90 on static feature cards
- :67 Icon-in-a-tinted-rounded-square feature grid. Evidence: div.rounded-md.bg-background/80.p-2.text-primary.shadow-sm wrapping Smartphone/Map/Fish/CalendarDays above each title in a 2x2 card grid; the logo chip does the same at LandingHeader.tsx:22
- :94 Uppercase wide-tracked micro-labels used as decoration. Evidence: text-xs uppercase tracking-[0.2em] text-primary/80 on placeholder boxes; also LandingHero.tsx:48 and :26, LandingFaq.tsx:30

## components/landing/LandingHeader.tsx
- :8 Marketing landing header (Features, Use cases, FAQ anchors) reused inside the logged-in app screens, plus a repo-style product name. Evidence: navItems = [{ label: 'Features', href: '/#features' }, { label: 'Use cases' ... }, { label: 'FAQ' ... }] with wordmark 'Fullstack AI Angler' (25); mounted at CatchDetailPage.tsx:140 and EditCatchPage.tsx:274
- :16 Glassmorphism / backdrop-blur chrome on every site page. Evidence: header 'bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60'; also dock FishingActionBar.tsx:27 'rounded-full border border-border/70 bg-background/95 ... backdrop-blur' and mobile bar FishingActionBar.tsx:54 'bg-background/95 ... backdrop-blur'
- :22 Icon in a tinted rounded square with a coloured glow as the brand mark; glow shadow on the CTA. Evidence: `rounded-xl bg-primary/15 p-2 text-primary shadow-sm shadow-primary/30` around lucide Fish; Sign in button `shadow-sm shadow-primary/30` at line 53; same tinted-circle icon pattern on ProfilePage.tsx:17 `rounded-full bg-primary/10 p-3 text-primary`
- :25 Dev project name and Vite defaults as brand. Evidence: wordmark "Fullstack AI Angler"; document title "client" and /vite.svg favicon (index.html:5,7)
- :53 Coloured glow shadows. Evidence: Sign in button shadow-sm shadow-primary/30; logo chip shadow-primary/30 (:22); hero CTA shadow-lg shadow-primary/35 (LandingHero.tsx:40)

## components/landing/LandingHero.tsx
- :5 AI sparkle iconography. Evidence: imports Sparkles and WandSparkles; Sparkles on stat "Smart insights shared" (:15), WandSparkles in the pill (:27)
- :12 Fabricated stat tiles for the sake of it. Evidence: hardcoded statCards "1,200+" Mapped locations, "4,800+" Trip plans generated, "12k+" Smart insights shared, rendered as three glass cards at :76-95
- :26 Pill badge above heading, uppercase and wide-tracked, with a sparkle icon. Evidence: rounded-full border-primary/30 bg-primary/10 text-xs uppercase tracking-[0.2em] with WandSparkles, "Inspired by modern UI libraries"; repeated in LandingFaq.tsx:30-33 with HelpCircle "FAQ"
- :31 Generic SaaS marketing phrasing and verb triplets. Evidence: "Plan, log, and relive"; "Get early access" / "View product tour" (:41, :44); "Smart insights shared" (:15); "without clutter" (LandingFeatures.tsx:110); "Designed for modern outdoor products." (LandingFooter.tsx:7); FAQ answers opening "Yes." / "It does." / "Absolutely." (LandingFaq.tsx:9, 14, 19)
- :35 Self-referential template copy about the redesign itself, shown to end users. Evidence: "We redesigned the landing experience with richer color, glassy surfaces, and modular sections ready for your illustrations..."; also h1 at :31 ends "with a premium UI."
- :40 Hero with two CTAs (primary with glow plus outline), neither wired up. Evidence: Button size=lg shadow-lg shadow-primary/35 "Get early access" and Button variant=outline "View product tour" (:43-45)
- :47 Placeholder illustration slots shipped as visible UI. Evidence: dashed box "Hero illustration slot" / "Drop a 16:10 fishing scene..." (:47-55), "Illustration slot A" / "Illustration slot B" (:66-71); LandingFeatures.tsx:94-96 and :112-114 "Placeholder for tactical illustration / dashboard image", "Placeholder for lifestyle art / photo"
- :63 Lucide icon attached to every card title and label, including a decorative arrow on a non-link. Evidence: ArrowUpRight beside "Live activity panel" though nothing is clickable; stat cards each carry an icon (:86); use case titles prefixed with Radar and Waves (LandingFeatures.tsx:85, :103)

## components/landing/LandingPage.tsx
- :9 Decorative gradient backgrounds with a hardcoded sky-blue radial glow. Evidence: [background-image:radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_36%)]; plus hero bg-gradient-to-b from-primary/10 (LandingHero.tsx:22) and footer bg-gradient-to-b from-muted/40 (LandingFooter.tsx:3)

## components/landing/LandingThemeToggle.tsx
- :38 More glass on the theme toggle. Evidence: rounded-full border-primary/30 bg-background/80 shadow-sm backdrop-blur

## components/profile/ProfileSettingsPanel.tsx
- :255 Default shadcn page-header pattern left untouched. Evidence: h1 `text-2xl font-semibold tracking-tight` + p `text-sm text-muted-foreground` inside default `Card` (`rounded-xl border py-6 shadow-sm`, card.tsx:10); same pairing on ProfilePage.tsx:20-26
- :292 Lucide icon glued onto metadata labels, applied inconsistently. Evidence: `<Database className="size-3.5" />` before 'User ID:' and `<CalendarDays className="size-3.5" />` before 'Joined:' (296), but 'Last profile update:' (303) has no icon
- :321 Stat tiles for the sake of it (uppercase micro-label over a big number). Evidence: Two bordered tiles: `text-xs uppercase tracking-wide text-muted-foreground` 'Followers' / 'Following' over `mt-1 text-2xl font-semibold` count (lines 313-342)
- :428 Over-labelled form, with filler copy that restates what is on screen. Evidence: 'Editable fields: display name, username, bio, and avatar image.' directly under those exact four fields; subtitle 'Manage the account fields saved in your app database.' (259)

## components/r2-image-picker.tsx
- :115 Infrastructure and vendor jargon in user-facing copy. Evidence: 'Could not upload image to Cloudflare R2.'; 'Uploading to R2...' (159); 'Saved to Clerk fallback profile' / 'Database is unavailable, so your profile was saved to Clerk metadata.' (ProfileSettingsPanel.tsx:229-233); 'Save app profile' (434); 'Manage account / delete in Clerk' (441); raw 'User ID' (293)
- :141 Boxes nested in boxes, all with the same rounded, bordered, soft-shadow look. Evidence: Picker card `rounded-xl border bg-card p-4 shadow-sm` sits inside the profile Card (`rounded-xl border shadow-sm`), next to bordered summary box `rounded-lg border bg-muted/20` (ProfileSettingsPanel.tsx:267), bordered stat tiles (315, 330), bordered gallery tiles (354), bordered preview tiles (r2-image-picker.tsx:166)
- :143 Over-labelled single image field (four lines of instruction) while the text fields above have no labels at all. Evidence: label 'Gear image' + 'Upload one image.' + 'Image keeps its original framing.' (ImageUploader.tsx:140) + 'Accepted: image/jpeg, image/png, image/webp • Max size: 10MB' (ImageUploader.tsx:81), vs LogGearPage.tsx:64-88 with placeholders only

## components/ui/button.tsx
- :7 Default shadcn primitives left untouched, including unused scaffolding. Evidence: Stock new-york v4 cva with unused `secondary`/`link` variants and `xs`/`icon-xs`/`icon-sm`/`icon-lg` sizes; card.tsx:10 stock `rounded-xl border py-6 shadow-sm`; index.css:33-45 and 68-80 unused chart-* and sidebar-* tokens; components.json baseColor `neutral`
- :8 Default shadcn Button left untouched; the rest of the form is unstyled raw HTML. Evidence: stock new-york cva classes; form inputs are bare `rounded border p-2` (LogCatchPage.tsx:374, 385, 394) with native select, checkbox and datetime pickers
- :12 Default shadcn new-york Button variants left untouched as the only styled controls. Evidence: default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border bg-background shadow-xs hover:bg-accent...', destructive: 'bg-destructive text-white...' used verbatim for Save gear, Edit, Delete, Previous, Next

## components/ui/fishing-bobber-loader.tsx
- :28 Infinite floating decorative loader animation. Evidence: `bobber-float` (translateY -4px, rotate ±4deg, 1.3s infinite) and blurred `bg-sky-400/50 blur-[1px] bobber-ripple` (line 29), keyframes at index.css:130-160; used for both the full profile load and inline uploads

## index.css
- :56 Blue-to-teal palette (primary blue, aqua accent, cyan in dark). Evidence: `--primary: oklch(0.59 0.17 244)` (#0083d9) with `--accent: oklch(0.79 0.12 181)` (#4dd4bf) at line 62; dark `--primary: oklch(0.75 0.14 214)` (#00c4e4) at line 90 and `--accent: oklch(0.74 0.1 181)` at line 96
- :62 Blue plus teal palette, with teal used as the generic hover fill. Evidence: Primary is `oklch(0.59 0.17 244)` blue (line 56) and accent is `oklch(0.79 0.12 181)` teal. Ghost and outline buttons hover to `bg-accent` (button.tsx:16,19), so Like, Comment, Follow and the filter chips flash teal on hover
- :84 Dark mode is the light palette with lightness inverted (same hues), plus untouched stock shadcn dark sidebar and chart tokens. Evidence: `--background: oklch(0.2 0.03 244)`, `--foreground: oklch(0.95 0.02 220)`, card `oklch(0.26 0.03 242)`; lines 102-114 are stock shadcn values (`--chart-1: oklch(0.488 0.243 264.376)`, `--sidebar-primary: oklch(0.488 0.243 264.376)`) that nothing uses

## pages/ProfilePage.tsx
- :17 Icon in a tinted circle above a centered heading, subtitle and single CTA card. Evidence: `rounded-full bg-primary/10 p-3 text-primary` with Fish icon, then h1 `text-2xl font-semibold tracking-tight`, muted p, Button, all `items-center text-center` in a `max-w-xl` card (lines 16-30)

## pages/fishing/CatchDetailPage.tsx
- :146 Scaffold palette that bypasses the theme: hardcoded white and slate on a themed app, so the card ignores dark mode. Evidence: article className="overflow-hidden rounded-xl border bg-white"; tiles bg-slate-50 / text-slate-500 / text-slate-900 (239-244); text-slate-300 (155)
- :161 Default shadcn look left untouched: stock primary text buttons dropped onto a photo as carousel controls instead of a designed gallery. Evidence: <Button type="button" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2">Prev</Button> and the same for Next (173-184)
- :239 Stat tiles for the sake of it: identical bordered tiles with tiny uppercase tracking-wide micro-labels, including a Size group whose tiles show only a dash when there is no data. Evidence: li className="rounded-lg border bg-slate-50 p-3" + p className="text-xs font-medium uppercase tracking-wide text-slate-500" repeated for 8 condition tiles (235-248) and 2 always-rendered size tiles (254-275)
- :262 Em dash in user-facing copy used as an empty value. Evidence: data.length !== null ? `${data.length} cm` : '—' (also line 272 for weight)

## pages/fishing/EditCatchPage.tsx
- :285 Unfinished scaffold form: raw unlabeled HTML inputs mixed with stock shadcn buttons, and a uniform gap-3 stack with no grouping. Evidence: <input name="title" className="rounded border p-2" required /> and datetime/textarea/select with the same class and no labels (285-314), next to <Button variant="outline"> (368) and <Button type="submit"> (493)
- :321 Developer-facing scaffold copy left in the UI. Evidence: No gear found in the database yet.

## pages/fishing/FeedPage.tsx
- :289 Glassmorphism on the main content panel. Evidence: `rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur-sm` wraps the whole feed, even though nothing sits behind it to blur
- :292 Default shadcn look left untouched for controls. Evidence: The filter chips are stock `Button`s swapping `variant` between `default` and `outline` (292-321). The dialog is stock shadcn (dialog.tsx:38). Leftover neutral `--sidebar-*` template tokens sit unused in index.css:73-80
- :349 Over-explaining system note placed above the content. Evidence: A bordered box reading `Your feed posts are created when you log a catch or log a fishing site.` shows on every visit for signed-in users
- :366 Uniform rounded cards with soft shadows, nested card-in-card. Evidence: Every post is a shadcn `Card` (`rounded-xl border shadow-sm`, card.tsx:10) inside the `rounded-2xl ... shadow-sm` panel at line 289, so there are double borders and double shadows
- :413 Developer enum values leaked into the UI as a meta line. Evidence: `{post.type} • {post.scope}` renders CATCH • GLOBAL
- :449 Placeholder filler copy. Evidence: `{post.content ?? 'No text'}` prints the literal text No text as a post caption
- :451 Walls of identical cards: catch and site posts use one template. Evidence: Catch and site posts render the same card. The only differences are the text `Catch: {title}` (453) or `Site: {name}` (458) and a raw enum meta line (413). No catch data (species, weight, length) and no site data is shown
- :471 Lucide icon attached to every action label. Evidence: `ThumbsUp` + Like (471), `MessageCircle` + Comment (482), `UserPlus` + Follow (406), `Check` + Following (393), `SlidersHorizontal` + Local radius (328)

## pages/fishing/LogCatchPage.tsx
- :277 Exclamation-mark celebratory toast titles. Evidence: `toast({ title: 'Catch logged!', variant: 'success' })`; LogSitePage.tsx:47 `'Fishing site logged!'`
- :363 Walls of identical bordered boxes and identical headings across every page. Evidence: `grid gap-3 rounded-lg border p-4` form wrapper repeated in 6 pages (EditGearPage:96, EditSitePage:131, LogSitePage:69, EditCatchPage:282, LogGearPage:61); `text-2xl font-semibold` h1 repeated 12 times; `rounded border p-2` on 44 controls
- :373 Over-labelled form: placeholder repeats the visible label. Evidence: label "Catch title" + placeholder "Catch title"; "Notes"/"Notes" (390/393); "Length"/"Length" (687/691); "Weight"/"Weight" (712/716)
- :553 Bullet glyph separators as decoration. Evidence: "• {brand} • {type}"; also ImageUploader.tsx:81 "... • Max size: 10MB"

## pages/fishing/LogSitePage.tsx
- :47 Exclamation-mark success toast filler. Evidence: toast title 'Fishing site logged!'
- :69 Default shadcn scaffold left untouched: every page is a bordered box with a text-2xl h1 and raw inputs. Evidence: 'grid gap-3 rounded-lg border p-4' + h1 'text-2xl font-semibold' + inputs 'rounded border p-2'; the same pattern repeats at EditSitePage.tsx:131-133, MySitesPage.tsx:83-84, SiteDetailPage.tsx:81-97

## pages/fishing/MyCatchesPage.tsx
- :108 Copy-pasted list pages producing walls of identical bordered rows, each with the same outline Edit plus red Delete pair. Evidence: className="flex flex-wrap items-center justify-between gap-3 rounded border p-3" repeated identically at MyGearPage.tsx:106 and MySitesPage.tsx:101, same section/search/pagination classes on all three

## pages/fishing/MySitesPage.tsx
- :101 Wall of identical bordered rows nested inside a bordered box. Evidence: row 'rounded border p-3' inside section 'rounded-lg border p-4' (83) with a bordered thumbnail 'rounded-md border' (108); the catch rows repeat this at SiteDetailPage.tsx:119

