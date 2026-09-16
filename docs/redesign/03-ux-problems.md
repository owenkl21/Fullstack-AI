# Appendix C. UX and accessibility problems found in the current build (file:line)

## ../index.html
- :7 The browser tab title is "client" with the Vite favicon, so the tab gives no product identity.
- :7 The browser tab and bookmarks read 'client' with the Vite logo favicon. A mobile-first app with safe-area handling ships no theme-color, manifest or touch icon, and no brand typeface is loaded (system font only).

## App.tsx
- :34 Unknown URLs silently redirect to the marketing page instead of showing a not-found message. A broken catch or site link looks like being logged out or sent home.
- :34 Inconsistent auth gating. My catches, sites and gear and Edit gear render only a signed-in branch, so signed-out users get a blank page under the chrome. Detail and edit pages have no gate at all. Unknown URLs silently redirect to the landing page with no not-found message.

## components/ChatBot.tsx
- :22 ChatBot, ChatInput, ChatMessages and TypingIndicator are dead code. Nothing in the client imports ChatBot; it was unmounted in commit 6017ab5, while POST /api/chat is still live on the server. The fishing assistant is therefore unreachable.
- :34 The chat plays sounds on every send and reply with no mute control. Errors show a generic pill with no retry. The empty state is a blank area with no guidance on what the fishing assistant can do. The chat's hard-coded gray and blue colours ignore dark mode.

## components/ChatInput.tsx
- :1 Icon libraries are mixed within the same app: lucide-react everywhere else, but react-icons MdErrorOutline and FaArrowUp in the chat components.
- :40 If the chat is revived, the send button is icon-only with no aria-label, and the textarea has no label and its focus outline removed (`focus:outline-0`), so there is no visible focus indicator.

## components/ChatMessages.tsx
- :28 Chat bubbles wrap ReactMarkdown output (which renders its own <p>, <ul> and similar) inside a <p>, which is invalid nesting. With no typography styles, markdown lists and headings render unstyled. There are no timestamps, no sender labels and no aria-live for new replies.

## components/ImageUploader.tsx
- :81 The helper line shows raw MIME types ('Accepted: image/jpeg, image/png, image/webp') instead of the human-friendly 'JPG, PNG or WebP'.
- :120 Pickers that allow multiple images still select one file at a time, because the hidden input has no `multiple` attribute. Uploading 8 catch photos takes 8 separate trips through the file dialog.
- :120 Image picker says "You can upload up to 8 images" but the file input has no `multiple` attribute and there is no drag-and-drop, so photos go in one at a time. The helper shows raw MIME types, errors mention "R2" and "Cloudflare R2", there is no image count, and the dropzone stays enabled at the limit. The <label> is not tied to any control.
- :129 The upload tile is styled as a dashed dropzone but has no drag-and-drop support, no paste support, no reordering and no cover-photo choice.
- :132 The dashed dropzone-style button implies drag and drop, but it only opens the file dialog on click. There are no drop handlers.
- :145 ImageUploader validation errors appear in a plain `text-red-500` paragraph with no role=alert or aria-live, using a hard-coded colour instead of the destructive token. After a validation error the input is not reset, so re-picking the same file may do nothing.

## components/TypingIndicator.tsx
- :5 The typing indicator's stagger classes `[animation-delay: 0.2]` and `[animation-delay: 0.4]` are malformed, so all three dots pulse in unison instead of in sequence.

## components/fishing/FishingActionBar.tsx
- :6 Mobile has no route to Add gear: the bottom bar lists only Feed, Catches, Sites and Gear plus a Log catch FAB, and the My gear page has no add button, so on phones /gear/new is unreachable without typing the URL.
- :6 Log site is unreachable on mobile. The mobile tab bar has Feed, Catches, Sites, Gear and a Log catch button only; 'Log site' exists only in the desktop dock. My locations and site detail have no create button either.
- :6 Navigation differs by breakpoint. Mobile has no Log site or Add gear entry. Neither variant has Home or Profile. Names drift ('Sites' on mobile vs 'Log site' / 'My locations' on desktop), and MapPin means 'list my sites' on mobile but 'create a site' on desktop, where the list uses LayoutGrid.
- :17 Navigation labels are inconsistent. The desktop dock says "My locations" and mobile says "Sites" for /sites/me. "Log catch" and "Add gear" share the identical Plus icon. Dock items show both a native title tooltip and a custom tooltip.
- :18 The desktop dock uses the identical Plus icon for 'Log catch' and 'Add gear' and labels items only in hover tooltips, so the two are indistinguishable without hovering and undiscoverable on touch laptops.
- :26 The fixed desktop dock (top-[5.25rem], about 84 to 150px) floats over hero content. At md widths (768 to 1023px), where the hero only has py-16, it likely covers the pill badge and top of the h1. It keeps covering content while scrolling.
- :26 The desktop dock is fixed at `top-[5.25rem]` and overlays feed cards while scrolling. Its items are icon-only, relying on hover tooltips, and two different actions (Log catch, Add gear) share the same Plus icon.
- :26 No nav item is active on /catches/:catchId or /catches/:catchId/edit, so the angler gets no sense of place. On desktop the fixed dock at top-[5.25rem] floats over scrolling content such as the hero photo.
- :26 The desktop dock stays fixed below the header and floats over form content when scrolling, which can cover fields and the map.
- :26 About 150px of permanent top chrome on desktop. The sticky header (~69px) and a separate fixed dock at top 84px both stay on screen while scrolling, and content scrolls underneath the dock pill. The 96px spacer only offsets the first paint.
- :32 On /gear/:gearId/edit no nav item is highlighted, because the NavLink to /gear/me doesn't match. On mobile, /gear/new also highlights nothing.
- :34 The dock hover lift and scale probably snap instead of easing. The transition list is `transform,...` but Tailwind v4's translate and scale utilities animate the separate `translate`/`scale` CSS properties (inferred, not browser-verified).
- :37 In dark mode the dock hover pairs the near-white foreground icon with the teal accent background (`hover:bg-accent hover:text-foreground`), about 1.9:1 contrast.
- :41 The desktop dock is icon-only, with labels only in hover or focus tooltips, and two different actions share the same Plus icon (Log catch, Add gear). Create and browse actions are interleaved with no grouping. Each item also has a native `title`, so a second browser tooltip appears on top of the custom one.
- :54 Three navigation landmarks (header nav, desktop dock, mobile tab bar) have no aria-label to tell them apart.
- :69 The active mobile tab label is 11px `text-primary` on the background, about 3.8:1 contrast, which fails WCAG AA for small text. The default Button's primary-foreground on primary is also about 3.8:1 for 14px labels, and destructive white-on-red is about 4.1:1.

## components/fishing/GoogleMapLocationPicker.tsx
- :28 No map search or address lookup, the default view is the center of the contiguous US at zoom 4, and there is no loading placeholder while the Maps script loads (an empty 320px bordered box). The unused parseGoogleMapsCoordinates helper shows a paste-a-link feature was considered but never wired up.
- :131 On Edit location, the map picker requests the device location as soon as it mounts and, if allowed, silently overwrites the site's saved latitude and longitude with wherever the user is standing. Saving then moves the spot.
- :131 The location permission prompt fires on page load with no user action, on both Log site and Log catch.
- :135 Developer and vendor jargon in user-facing copy: the map error tells users to 'Set VITE_GOOGLE_MAPS_API_KEY', uploads say 'Uploading to R2...' and 'Could not upload image to Cloudflare R2.', and the uploader helper lists raw MIME types 'image/jpeg, image/png, image/webp'.
- :135 The map failure message exposes a developer env var to anglers ("Set VITE_GOOGLE_MAPS_API_KEY"). The map defaults to the centre of the USA at zoom 4, has no place search or coordinate readout, and the geolocation error uses the same muted grey as helper text.
- :141 The map picker's init effect depends on onChange, which the page recreates on every render. Any re-render (weather loading flag, unit select, date, gear toggle) rebuilds the map and marker and re-runs geolocation, so a manually placed pin can snap back to the device location.
- :144 The picker never shows existing coordinates on first load. The sync effect returns early before the map exists and does not re-run after init, so on Edit (with location denied) the pin sits at the US center at zoom 4 while the inputs show the saved coordinates.
- :148 Coordinate inputs show no units, format or range. Every keystroke pans and zooms the map to 14, and clearing a field sends the pin to 0 because Number('') is 0.
- :164 When the map fails to load, the whole picker, including 'Use current location', is replaced by a grey sentence, leaving only manual lat/lng typing.
- :185 The picker's location error is grey `text-xs text-muted-foreground`, not styled as an error, so it is easy to miss.

## components/landing/LandingFaq.tsx
- :43 FAQ is a static stack of fully expanded cards with no disclosure pattern. It adds length without letting users scan questions.

## components/landing/LandingFeatures.tsx
- :14 Marketing copy promises features the app does not have: trip planning, seasonal recommendations, tournament prep, and a "Trip plans generated" stat. App routes only cover catches, sites, gear, feed and profile (App.tsx:19-35).
- :45 Anchor jumps (#features, #use-cases, #faq) have no scroll-margin-top. The sticky header (about 69px) and on md+ the fixed dock hide the section heading after the jump.
- :81 The #use-cases target has no heading or label, so the jump lands on two cards with no context.
- :94 Low-contrast micro text: text-xs uppercase labels in text-primary/80 on bg-muted/30 or bg-card/60 risk falling below 4.5:1, especially in light mode.

## components/landing/LandingFooter.tsx
- :10 Footer Privacy and Terms are href="#" dead links. "Contact" points to #faq, which contains no contact information.

## components/landing/LandingHeader.tsx
- :8 The header on the app's profile page still shows marketing anchors (Features, Use cases, FAQ) instead of app navigation (Feed, My catches, Sites, Gear).
- :8 The header on every app page shows marketing anchors (Features, Use cases, FAQ) that do full navigations back to the landing page, while real app destinations live only in the dock.
- :17 The header content width (max-w-6xl) and feed width (max-w-4xl) do not align, so the brand and feed column edges are offset on desktop.
- :17 The header container (max-w-6xl) and page content (max-w-4xl) have different widths, so the logo and page content don't share a left edge on desktop.
- :20 Wordmark plus three header controls likely crowd a 375px-wide row (px-4 gutter), risking the "Fullstack AI Angler" text wrapping to two lines.
- :28 On mobile a signed-in user has no route to /profile from the home page. The Profile link is md+ only, the hamburger is dead, and the bottom bar has no profile tab.
- :28 The profile page cannot be reached on mobile. The only link to /profile is in the header nav, which is `hidden md:flex`. The mobile hamburger button has no onClick, ProfilePage has no FishingActionBar, and no other file links to /profile.
- :29 The Clerk loading gap causes layout shift. Neither Show branch renders until Clerk resolves, so Sign in or the avatar and the Profile link pop in after first paint.
- :38 Header section links are plain <a href="/#...">, not router Links. Because this header is on every page, clicking Features, Use cases or FAQ from an in-app page (e.g. /catches/new) does a full reload back to the marketing page, and marketing links clutter the app navigation.
- :52 There is no sign-up path for new visitors. The only auth entry is a small header "Sign in" (Clerk modal); the hero primary CTA does not open sign-up or sign-in.
- :53 Small tap targets: header "Sign in" is h-8 (32px), theme toggle and hamburger are 36px, footer links are unpadded 14px text (about 20px tall), and mobile tab labels are text-[11px].
- :63 The mobile hamburger button does nothing (no onClick, no sheet). Below md the nav is hidden, so phone users cannot reach Features, Use cases, FAQ or (when signed in) Profile from the header.
- :63 The mobile hamburger button in the header has no handler and does nothing. The header also shows marketing anchors (Features, Use cases, FAQ) inside the app.
- :63 The mobile 'Open navigation menu' button has no onClick, so it is a dead control on every page in this group. The header's Features / Use cases / FAQ links jump to the landing page from inside the app.
- :63 The header's mobile menu button has no onClick, so tapping it does nothing. Profile and the landing links are therefore unreachable on mobile.
- :63 The mobile hamburger menu button is a dead control: it has an aria-label but no handler and no menu.
- :63 The header's mobile hamburger button has no handler and does nothing. Header nav links on these app pages point to landing-page anchors (Features, Use cases, FAQ).
- :63 The mobile hamburger button has no onClick and no menu behind it, so it is a dead control. The header text nav, including the only Profile link, is `hidden md:flex`, so /profile can't be reached from the app UI on phones.
- :63 While Clerk resolves auth, neither Show branch renders, so the page is briefly blank below the chrome. The header's mobile Menu button has no handler (a dead control).

## components/landing/LandingHero.tsx
- :24 On mobile the hero stacks text, CTAs, placeholder box, activity panel and three stat cards before any real product information. The fake stats push the Features section several screens down.
- :40 Both hero CTAs are dead. "Get early access" and "View product tour" have no onClick, href or asChild link.
- :63 The hero "Live activity panel" card shows an ArrowUpRight link affordance, and feature cards change opacity on hover, but neither is clickable. These are false affordances.

## components/landing/LandingThemeToggle.tsx
- :26 Theme flashes light on load for dark users. The .dark class is applied in useEffect after first paint and index.html has no pre-paint script.
- :26 Theme is applied in an effect after mount with no pre-paint script, so dark-preference users see a light flash on every load. `color-scheme` isn't declared, so native selects, date pickers and scrollbars stay light in dark mode. Clerk sign-in and UserButton get no appearance theming.
- :28 The toggle writes localStorage on first mount, freezing the OS colour-scheme preference. Later OS changes are ignored, and there is no system option or matchMedia listener.

## components/profile/ProfileSettingsPanel.tsx
- :131 When the profile fails to load, the user gets a toast plus a page full of 'Unavailable' values, zero counts and blank required inputs, with no inline error or retry button.
- :227 Save toasts expose backend internals ('Profile saved to database', 'Saved to Clerk fallback profile', 'Database is unavailable, so your profile was saved to Clerk metadata.').
- :238 Saving the profile always sends the user away to the home page, so they never see the saved result and cannot keep editing.
- :241 Every save failure (duplicate username 409, validation 400, server 500) shows the same generic toast, 'Please review your values and retry.' Specific server messages such as 'That username is already in use.' are thrown away, and no field is highlighted.
- :267 The summary grid gives the 64px avatar a full third of the width at sm and up (`sm:grid-cols-3`), which leaves a large empty column.
- :269 The two avatar displays disagree. After upload, the picker shows the new avatar as a 4:3 rectangle while the circular summary avatar keeps the old one until save. An uploaded but unsaved avatar is silently discarded when the user leaves, with no unsaved-changes warning.
- :293 The identity summary shows the email and an internal database 'User ID' (meaningless to an angler) but not the display name, @username or bio. 'Last profile update' is system metadata presented at the same level as 'Joined'.
- :313 The Followers and Following tiles are native buttons with no hover state, no focus-visible style, no aria-haspopup and no visual cue (chevron or 'View') that they open a list.
- :345 Page order buries the edit form: the read-only gallery (up to 12 images) sits between the stat tiles and the form, pushing Save far below the fold. The page title says 'Profile settings' but mixes public-profile content with settings.
- :351 Gallery tiles are dead ends. They are not links even though sourceId is available. The badge shows the raw enum 'CATCH' or 'SITE' at 10px. The gallery is silently capped at 12, with catches first, so sites can be cut off, and there is no 'see all' link.
- :369 The empty gallery state is a single muted sentence with no button or link to /catches/new or /sites/new.
- :381 The form uses raw inputs with no custom focus style, no placeholders and no inline errors, which is inconsistent with the shadcn buttons and their 3px focus ring.
- :402 The Username field enforces `pattern="[a-zA-Z0-9_]+"`, 3 to 40 characters, with no helper text. Users only get the browser's generic 'match the requested format' tooltip. There is also no @ prefix to show it is a handle.
- :414 The Bio field has a 280-character maxLength but no counter. Typing simply stops at the limit with no explanation.
- :436 'Manage account / delete in Clerk' is an outline button with the same size as, and directly beside, the primary Save button. The word 'delete' in the label and the vendor name make it confusing, and it is easy to hit by mistake.
- :449 On close, the dialog title is cleared immediately, so during the exit animation the description reads 'Browse and search your  list.'
- :464 The connections search input has only a placeholder, no label or aria-label. It fires a request on every keystroke with no debounce, and each keystroke replaces the list with the text 'Loading...', which causes flicker.
- :478 Connection rows are not actionable: no link to the person, no follow or unfollow, no pagination. 'No users found.' is shown both when the user has no followers and when a search has no matches.

## components/r2-image-picker.tsx
- :32 The site image picker is limited to one image by mistake. LogSitePage passes label 'Site images' and maxItems 12 but no `multiple`, and R2ImagePicker defaults `multiple` to `scope === 'catch'`. Sites therefore show 'Upload one image.' and reject a second upload.
- :32 Site images only accepts one photo. R2ImagePicker's `multiple` defaults to false for scope 'site', so the helper says 'Upload one image.' and a second image is rejected, even though maxItems={12} is passed and the API allows 12.
- :46 Upload feedback is split across two patterns: type and size errors show inline under the tile (ImageUploader), while network, limit and single-image errors show as toasts (R2ImagePicker).
- :47 'Maximum 1 images allowed.' is ungrammatical for the single-image gear picker.
- :102 Upload progress is only a small inline 'Uploading to R2...' loader, with no per-file progress or count. The select tile stays enabled during upload. A second selection made mid-upload runs with the older `value` closure and can overwrite the first upload's result when it calls onChange.
- :125 The single-image picker won't replace: choosing a second photo gives the error toast 'Only one image is allowed here.', forcing remove-then-reupload. This is awkward on a field labelled 'Replace image'.
- :125 Single-image pickers (avatar, gear) cannot replace an image in place. Choosing a new file while one exists shows an error toast telling the user to remove the current image first.
- :143 The picker's <label> has no htmlFor and isn't associated with the hidden file input.
- :143 The picker's `<label>` is not associated with any control (no htmlFor), so screen readers do not announce 'Avatar image' or 'Catch images' for the select button.
- :158 Save catch is not disabled while images are still uploading, so a catch can be saved without in-flight photos.
- :159 Implementation jargon in user-facing copy: 'Uploading to R2...', 'Could not upload image to Cloudflare R2.', and raw MIME types in the helper line.
- :174 'Remove image' acts instantly with no confirmation or undo, and nothing indicates the change is unsaved until the parent form is submitted.

## components/ui/button.tsx
- :25 Row action buttons in the My catches, sites and gear lists use Button size sm (32px tall), below comfortable touch size, right next to a destructive Delete.

## components/ui/card.tsx
- :33 Card titles (feature names, FAQ questions, stat labels) render as divs via CardTitle, not headings. This flattens the document outline for screen readers; only the h1 and the two h2s are real headings.
- :33 CardTitle renders a div rather than a heading, so card titles aren't in the document outline for assistive tech.

## components/ui/carousel.tsx
- :100 The carousel has no swipe or drag on touch devices, no keyboard arrow support, no slide position indicator, and 32px arrow buttons overlaid on the photo. Feed images all use the generic alt text 'Post'.
- :137 The image carousel has no swipe gesture on touch devices, no position indicator or count, and 32px arrow buttons (below a 44px tap target). Images cannot be opened full size.

## components/ui/dialog.tsx
- :21 The dialog has animate-in/animate-out with no fade or zoom modifiers, so it pops in and out abruptly while still waiting out a 200ms duration on close.
- :38 DialogContent is `w-full max-w-lg` with no horizontal margin, so on phones the modal touches both screen edges. Its close button has `focus:outline-none` with no replacement focus indicator.
- :38 The dialog has no side margin on narrow screens (`w-full max-w-lg`), so it runs edge to edge with rounded corners on phones. It also has no max-height or scroll for long content such as the connections list.
- :44 The unfollow confirm button uses the primary variant rather than destructive. The dialog closes before the request resolves, with no feedback. The dialog's close X uses `focus:outline-none`, so keyboard focus on it is invisible.
- :44 The dialog close X removes its focus outline (`focus:outline-none`) with no replacement, so keyboard users can't see focus on it.
- :73 On phones the dialog is `w-full` with no side margin, and its stacked footer buttons have no vertical gap (`sm:space-x-2` applies only from sm).
- :73 DialogFooter stacks buttons on mobile with no gap (spacing is `sm:space-x-2` only), so Cancel and Unfollow touch. The unfollow confirmation also uses the primary blue button rather than a destructive style.

## components/ui/fishing-bobber-loader.tsx
- :17 The loader box has no fixed height and is swapped for content on arrival, causing layout jumps. There is no error fallback, so pages whose fetch fails can sit on the loader indefinitely alongside an error toast. The upload label exposes vendor jargon ('Uploading to R2...').
- :26 The bobber loader's infinite float and ripple animation ignores prefers-reduced-motion and uses hardcoded red, white and sky colours that do not adapt to dark mode.
- :28 The loader's infinite bobbing animation has no prefers-reduced-motion override.
- :28 The loader animation loops indefinitely with no prefers-reduced-motion fallback.
- :28 The bobber loader is likely drawn misaligned. The animated body and ripple carry both Tailwind's `-translate-x-1/2` (CSS `translate`) and a keyframe `transform: translate(-50%)`, so they shift half their width left of the static cap and stem. The white body (`bg-white border-white/60`) is also nearly invisible on the near-white light background, and its palette colours ignore theme tokens.

## components/ui/slider.tsx
- :30 The slider thumb is 20px, well under a 44px touch target. The Feed radius slider has no accessible name because the visible 'Local radius' text isn't linked, and its minimum of 0 km is a meaningless radius.

## components/ui/toast.tsx
- :20 Toasts are not announced to assistive tech: no role=status or aria-live on the toast or the Toaster container. They also appear and vanish without animation after 4.5s, overlapping the sticky header.
- :21 Toasts have no role or aria-live, so screen-reader users never hear save or error results. Success and error differ only by a thin pastel border (no icon or wording cue). They auto-dismiss after 4.5s with no pause on hover or focus, and have no enter or exit animation.

## components/ui/toaster.tsx
- :8 On mobile the toaster is `fixed right-4 w-full px-4`, which pushes toasts flush against the left screen edge with an uneven right gap, overlapping the sticky header.
- :8 On phones the toast stack (fixed top-4 right-4, w-full, px-4) is shifted so toasts touch the left screen edge and cover the sticky header and user menu. Success and error differ only by border colour (emerald-300 vs red-300), with no icon.
- :8 On mobile the toast stack is `fixed right-4 w-full px-4`, which pushes its left edge off-screen. Toasts sit flush against the left edge with a 32px gap on the right.
- :8 On phones the toast stack is `fixed right-4 w-full px-4`, so toasts touch the left screen edge with a 32px gap on the right.

## components/ui/use-toast.ts
- :17 Toast ids use `crypto.randomUUID()`, which only exists in secure contexts. Testing on a phone over plain http on a LAN IP would throw inside every toast() call.

## index.css
- :119 Raw input, select and textarea elements have no focus style of their own, only the global outline-ring/50 tint on the browser outline. That does not match the 3px focus ring on shadcn Buttons in the same forms.
- :122 The global body style has `pb-24` on mobile to clear a bottom action bar, but ProfilePage has no action bar, so 96px of blank space is left at the bottom.
- :152 No reduced-motion handling anywhere in live CSS: the infinite bobber float and ripple, dock magnification, carousel slide and smooth scrolling all ignore prefers-reduced-motion.

## main.tsx
- :11 A missing Clerk publishable key throws before React renders, leaving a blank white page with no visible error.
- :17 Clerk components (sign-in modal, UserButton menu) get no appearance config, so they do not follow the app's dark mode.
- :22 Scroll position isn't reset on route change (BrowserRouter with no ScrollRestoration or scrollTo anywhere), so opening a detail page from a scrolled list can land mid-page.

## packages/server/services/fishing.service.ts
- :554 Saving the edit form silently wipes data shown on the detail page. Humidity and UV index are always written as null (fishing.service.ts:184-185), so those tiles disappear after any edit. The fish count is reset to 1 because the form never sends count (fishing.service.ts:554). waterTemp is also nulled.
- :635 Logging a site silently creates a public GLOBAL feed post with its description and coordinates. The form never tells the angler their spot will be published.

## pages/HomePage.tsx
- :4 Signed-in and signed-out users get the identical marketing page. HomePage has no auth branch, so a signed-in angler lands on "Get early access" and fake stats with no recent catches, no quick log and no personal summary. Only the header auth control and a desktop-only Profile link differ.
- :8 The action bar is placed after the footer. Its md+ h-24 spacer plus the pb-16 wrapper leave about 160px of blank background under the footer on desktop. On mobile, pb-16 plus body pb-24 (index.css:122) do the same.
- :9 The action bar is rendered for signed-out visitors. Catches, Sites and Gear (and the My catches, My locations and My gear dock items) open pages wrapped only in Show when="signed-in" with no signed-out fallback, leaving an empty page and a dead end (e.g. MyCatchesPage.tsx:91, MySitesPage.tsx:82, MyGearPage.tsx:87).
- :9 The app nav is mounted on the landing page for signed-out visitors. The dock floats over the hero, the mobile tab bar and FAB link to auth-gated pages, and the desktop spacer renders after the footer as extra blank space.

## pages/ProfilePage.tsx
- :10 No shared layout route: 13 pages each mount the header and nav themselves. ProfilePage omits FishingActionBar, so it has no app nav, yet body `pb-24` still reserves 96px of empty space at the bottom on mobile.
- :12 There is no loading fallback for Clerk's auth check: while Clerk initialises, both <Show> branches render nothing and the main area is blank.

## pages/fishing/CatchDetailPage.tsx
- :14 The detail page drops the social and context data the API already returns: angler (createdBy.displayName/username), likeCount, commentCount, species.scientificName, count, depth and the weather icon. There is no way to see who caught it or to like or comment.
- :59 Neither page handles load failures. A deleted or nonexistent catch, a network error, or (on edit) a signed-out user hitting the auth-only /api/gear leaves the bobber loader spinning forever. There is no not-found message, retry or sign-in prompt.
- :146 Dead ends. The detail page has no Edit, Delete or back link, even for the owner. The edit page has no Cancel/Back and no Delete. Delete exists only as a native window.confirm on the My catches list (MyCatchesPage.tsx:67).
- :146 Dark mode breaks the detail card. The article is hardcoded bg-white while text inherits the light dark-mode foreground, so the title, species, notes and site link become near-invisible. Tiles use fixed slate colours.
- :149 Gallery is minimal and inaccessible. Every photo has alt="Catch". Text 'Prev'/'Next' buttons sit on the photo with no position counter, dots or thumbnails, and there is no swipe or keyboard support. A fixed h-96 with object-cover crops portrait fish photos. activeImage is not reset when catchId changes.
- :191 The caught date uses raw toLocaleString, which includes seconds and depends on the browser locale (e.g. '15/09/2026, 10:30:00').
- :193 Weak hierarchy on detail. Species, the key fact, is a plain 16px 'Species: X' line under the date. Group labels Gear/Conditions/Size/Site are <p className="font-medium"> at body size rather than headings, so the document outline has only the h1. Notes come last, after the map, with no heading.
- :239 Hardcoded light colours break dark mode on catch detail: white article and slate-50 stat tiles with slate-900 text stay light on a navy page.
- :252 The Size group always renders two tiles showing only a dash when length and weight are empty, which is noise rather than information.
- :290 The embedded Google Map is a 256px interactive iframe that can capture scroll and touch on mobile. It has no 'open in maps' or directions link, and the site name link is just underlined text.

## pages/fishing/EditCatchPage.tsx
- :108 The browser location permission prompt fires as soon as the edit page mounts, with no explanation. If denied, it fails silently and only surfaces later as the 'No coordinates available' toast.
- :121 Edit page has no client auth gate. Signed-out visitors wait on an endless loader. Signed-in non-owners can open another angler's catch in the editor, fill it in, and get no feedback when the save fails.
- :193 Save has no submitting state and no error handling. The Save button never disables, so double submits are possible. Any 400/401/404/500 is an unhandled rejection with no toast or inline error. Examples: a 1-character title (server needs 2), whitespace-only notes, a rebuilt snapshot with an empty iconBaseUri failing .url(), or a non-owner saving (404).
- :229 'Load latest conditions' pulls weather as of right now, not when the fish was caught, and overwrites the stored historical conditions with no confirmation or undo. The label 'latest' does not explain this.
- :230 Condition refresh uses the catch's originally saved site, not the site currently chosen in the dropdown. The select is uncontrolled, and the lookup uses item?.site?.id. Changing the site and then refreshing fetches weather for the old location.
- :255 When the upstream weather lookup fails, the server returns HTTP 200 with weather: null (fishing.controller.ts:48-54). The client then clears Overview and all read-only condition fields but still shows the success toast 'Conditions updated'.
- :280 The edit form cannot change species, fish count, depth or photos. Species shows on detail as 'Species: Not specified' with no way to fix it here, and images cannot be added, removed or reordered after logging.
- :285 Title, date/time, notes and site have no visible label, placeholder or aria-label. The form opens as four unexplained boxes, and screen readers announce unnamed fields.
- :288 Raw native controls have no designed focus style (only the browser outline tinted by global outline-ring/50), which is inconsistent with the 3px ring on shadcn buttons on the same form.
- :294 The edit form saves the wrong catch time on every save. The datetime-local default is the UTC time (ISO string sliced), but on submit the value is parsed as local time. In Africa/Johannesburg (UTC+2) each save moves the catch 2 hours earlier. The same catch also shows different times on detail (toLocaleString, local) and edit (UTC).
- :308 Inconsistent terminology between the two catch pages: 'Site' on detail vs 'No fishing spot selected' on edit; 'Wind gusts' vs 'Wind gust'; 'Gear' vs 'Gear used'. The action bar also mixes 'Sites' and 'My locations'.
- :324 The gear checklist lists every gear item from every user (gear.service.ts:132-138) and the site dropdown lists every user's sites (fishing.service.ts:330-341). The gear list is a long, unsearchable run of checkbox rows, pushing Save far below the fold. Selected rows get no highlight, and the server's 20-item limit is never shown.
- :378 Mixed typography inside one form. Title/Date/Notes/Site inputs render at 16px regular, while inputs nested in labels (Overview, conditions, Length, Weight) inherit text-sm font-medium and render at 14px medium.
- :392 The read-only Temperature, Cloud cover, Wind and Wind gust inputs look identical to editable inputs, so users will try to type in them. Precipitation, Humidity and UV index shown on detail are missing from the editor entirely.
- :450 Unit selects (cm/ft, kg/lbs) do not convert the number already typed. Switching cm to ft on a 45 cm fish saves it as 45 ft (1371.6 cm). 'ft' with step 0.1 is an odd unit for fish length (inches missing). There is no min attribute. Detail always shows cm/kg regardless of what the angler entered.

## pages/fishing/EditGearPage.tsx
- :42 Edit gear fetches the entire /api/gear/me list and searches it client-side to find one item.
- :52 If loading gear fails, the error toast fires but gear stays null, so the 'Loading gear...' bobber animates forever with no retry or way out.
- :77 An existing gear photo can't be removed. The image is only sent when replaced, and 'Remove image' only clears a newly uploaded file. The current photo sits outside the 'Replace image' card and silently vanishes once a new one uploads.
- :81 Edit gear save has no try/catch, no submitting state and no disabled button. A failed PUT (for example a 400 for a whitespace-only name) gives no feedback, and double submits are possible.
- :99 The Edit gear inputs have neither labels nor placeholders. If the angler clears a field, nothing indicates which field it is.

## pages/fishing/EditSitePage.tsx
- :126 Edit location has no auth or owner gate. Signed-out users and non-owners see a fully editable form and only learn on save, through a generic 'Unable to update location' toast.
- :129 Images cannot be added, removed or replaced after creation. Edit location has no image picker, and the update API has no images field.
- :133 Terminology is inconsistent for the same object: 'Log fishing site', 'Edit location', 'My locations', 'Sites' tab, 'Unable to load your sites', 'Location deleted'. Toast phrasing also varies ('Check your values and try again.' versus 'Please check your values and try again.').
- :134 Every Edit location field has no label; they rely on placeholders that disappear once filled. Log site labels the same fields, so the two pages are inconsistent and the edit form fails accessibility basics.
- :150 Edit location has two different current-location buttons ('Use my current location' in the Location options box and 'Use current location' in the picker) with different feedback (toasts versus inline grey text).

## pages/fishing/FeedPage.tsx
- :91 Filter, scope and radius choices are not reflected in the URL or persisted, so they reset on every visit or back navigation. Filters and slider are not sticky and scroll away while browsing.
- :107 `isLoading` starts false, so `No feed posts found.` flashes on first paint before the initial fetch starts.
- :126 The Local scope never asks the server for nearby posts. It always sends `scope: GLOBAL`, then filters on the client only the 25-post pages already loaded. Nearby posts beyond those pages stay invisible, and the server's NEARBY radius query is dead code.
- :142 Geolocation is requested again with `enableHighAccuracy: true, maximumAge: 0` and an 8s timeout on every load in Local mode: the first page, every infinite-scroll page, and after every like, comment, follow and unfollow. That adds repeated GPS delays and battery drain.
- :180 A feed load error only shows a transient toast. The list area keeps stale posts or shows the misleading `No feed posts found.`, with no inline retry.
- :204 Infinite scroll depends only on the window scroll event, with no IntersectionObserver or Load more button. When filtering leaves the page shorter than the viewport (typical in Local), no scroll event can fire, more pages never load, and the user hits a dead end on the empty radius message.
- :228 Local mode drops any post without coordinates. Catch posts are created without latitude/longitude (server fishing.service.ts:443-451), so Local plus Catch feed is always empty, and Local plus All only ever shows site posts. Nothing in the UI explains this.
- :245 Like has no optimistic update or pending state. Each click refetches page 1, discarding every page loaded beyond the first and jumping the scroll position. Double clicks send two toggles.
- :245 Like, comment, follow and unfollow have no error handling at all. Failures become unhandled promise rejections with no user feedback, and successes get no confirmation either.
- :289 Stacked padding (main px-4, panel p-4, card px-4) leaves about 48px of horizontal padding per side on a 375px phone. Card-in-panel nesting also doubles borders and shadows.
- :291 Five toggle buttons mix two independent filters (scope Global/Local and type All/Catch/Site) in one row with identical styling and no grouping or labels. They have no aria-pressed or radiogroup semantics, wrap to multiple lines on phones, and the `All feed / Catch feed / Site feed` wording is redundant.
- :333 The radius slider has no accessible name (no aria-label, the visible `Local radius` label is not associated with it), allows 0 km (which shows nothing), and is km only. It re-filters silently with no count of matching posts.
- :348 The signed-in helper note is permanent, takes space above the posts, and names two actions (log a catch or site) without linking to them.
- :373 No author avatar is shown although `author.avatarUrl` is returned, so the only identity cue is two lines of small text.
- :382 The `Following` status pill is a raw button about 24px tall with no hover or focus-visible style. A control that looks like a status badge unexpectedly opens a confirmation dialog.
- :413 The meta line shows raw enums `CATCH • GLOBAL`. Scope is always GLOBAL, so half of it is noise. There is no post date or time even though `createdAt` is returned, and no distance even in Local mode where it is computed.
- :429 Every feed image has the alt text `Post`, which gives screen reader users nothing about the photo, catch or spot.
- :449 Posts without notes or description show the literal caption `No text`.
- :451 Cards are dead ends. The catch title, site name, images and author are not links, even though `/catches/:catchId` and `/sites/:siteId` detail pages exist and author ids are available.
- :463 Signed-out users see a clickable Like button, but the endpoint requires auth. The 401 is swallowed (no try/catch, no toast) and nothing prompts sign-in.
- :466 The liked state is shown only by colour (`text-primary`). The label stays `Like`, the icon is not filled, and there is no aria-pressed, so the state is invisible to screen readers and weak for colour-blind users.
- :487 The counts line is not pluralised (`1 comments`, `1 likes`) and sits below the Like/Comment buttons instead of next to them, so the count and its action are separated.
- :495 Only the 5 most recent comments come back (newest first). There is no `View all N comments` even when `commentCount` is higher, so older comments cannot be reached, and comments have no timestamps or delete-own option.
- :512 Signed-out users can open comments but get no composer and no prompt to sign in to comment.
- :514 The comment input has no label or aria-label (placeholder only), bypasses the design system's input styling, has no maxLength (server limit 1000), and pressing Enter does not submit because there is no form.
- :528 The comment send button is icon-only with no aria-label, is never disabled for empty input (it silently ignores the click), and shows no submitting state, so duplicate posts are possible.
- :548 Loading feedback is small muted text placed after the post list, so during a reload triggered by a like or comment it renders below existing posts and is usually off-screen. There is no skeleton, and it is inconsistent with the FishingBobberLoader used on MyCatchesPage, MySitesPage, CatchDetailPage and others.
- :558 When location access fails, the red error in the radius panel is paired with the empty message `No posts found inside this radius yet.`, which wrongly blames the radius. There is no retry or Use Global option.
- :558 The empty, loading-more and end-of-feed messages can show at the same time (for example `No posts found inside this radius yet.` together with `You reached the end of the feed.`). Empty states have no call to action such as log a catch or widen the radius.

## pages/fishing/LogCatchPage.tsx
- :149 For Other, empty custom coordinates count as a valid location: Number('') is 0, which is finite. Weather is fetched for 0,0, and the "Drop a pin on the map" check never fires, so if the map fails to load or geolocation is denied, a site is created at 0,0. The helper text claiming weather is cleared without coordinates is therefore wrong.
- :151 A selected site that has no coordinates silently falls back to the device location for weather, with no indication.
- :163 The weather snapshot is always current conditions, even if the angler backdates "Date and time". caughtAt is not passed to the weather lookup, so a catch logged hours later gets the wrong weather stored.
- :176 Weather refetches on every coordinate change (every pin drag or click, every geolocation update) with no debounce or abort, so responses can arrive out of order and overwrite newer data.
- :204 "Use current location" (the default) does not save any location. It only feeds the weather lookup; the catch is posted with siteId null and no coordinates. The label promises something the save does not do.
- :229 Double-submit risk: isSaving is only set after the Other-site POST. During site creation the Save button is still enabled, and a repeat click can create duplicate sites. If the catch save then fails, an orphan site is left behind.
- :280 On a 500 error the page silently resubmits without images and the photos are dropped, with a neutral toast that blames upload reliability. Uploaded files stay orphaned.
- :305 Validation lives only in top-right toasts that auto-dismiss after 4.5s. No inline messages, no field focus, no aria-live on the Toaster container. Server 400s (for example a 1-character title, which fails min 2) have no message, so the angler just sees "Check your values and try again."
- :361 No draft or autosave and no unsaved-changes guard. Navigating via the always-visible dock or bottom nav discards a half-filled catch and leaves uploaded photos orphaned.
- :366 The options loader appears inside the form while every field below is already interactive, so dropdowns show empty or "no gear" states during loading.
- :369 No species field at all. The Catch model has speciesId/species (schema.prisma:123-124), but the form never asks what fish was caught, so the free-text title has to carry it.
- :371 Title and notes have no maxLength or character counts, although the server enforces 2-120 and up to 2000 characters. datetime-local gives no timezone cue.
- :374 There are no Input, Select, Textarea or Label primitives. About 60 raw controls use at least four different class recipes (`rounded border p-2`, `w-full rounded border px-3 py-2 text-sm`, `rounded-md border border-border bg-background px-3 py-2`, `rounded-full border px-3 py-2 text-sm`). None has its own focus or invalid styling or a background token, and they don't match Button radius, height or type size in the same form.
- :389 Field order is not how an angler thinks: free-text Notes comes before location, gear and measurements; the read-only weather block sits between gear and length/weight; photos (often the main thing) are at the very bottom. One long single-column form with no progressive grouping or sticky save.
- :401 Location and Gear dropdowns are hand-built inline disclosures. No aria-expanded, no listbox or option roles, no arrow-key navigation, no close on outside click or Escape, no selected marker in the list, and ▲/▼ text glyphs instead of icons. Their search inputs have no label.
- :411 Wording drifts between location, spot and site, and the same option has two names: the trigger says "Other (create new location)" while the list row says "Other (add new spot)". "Use current location" also appears twice with different meanings (dropdown default vs the map button).
- :474 The customSpot input has native `required`, so the browser bubble fires first and the custom "Site name is required" toast is unreachable. Two validation styles are mixed.
- :514 Gear list loads GET /api/gear, which returns every user's gear (gear.service.ts listGear has no owner filter), so anglers pick from strangers' kit. The empty state "No gear found in the database yet." is also a dead end with no link to /gear/new, and it shows while gear is still loading.
- :532 Raw inputs, selects, checkboxes and dropdown row buttons have no designed hover or focus state. Only shadcn Buttons get a focus ring; the rest rely on the browser outline tinted by outline-ring/50. Native checkboxes and p-2 rows are small tap targets.
- :565 Similar pages behave differently: Edit catch has a manual "Load latest conditions" button with success and error toasts, and an editable Overview field (EditCatchPage.tsx:368-377). Log catch auto-fetches silently into read-only fields.
- :573 Weather is shown as 8 read-only text inputs that look identical to editable fields. Empty values show blank boxes plus the literal text "Weather icon". Fetch failures are silent (the server's weatherError is ignored).
- :697 Unit choices are odd and unlabelled: fish length offers cm or ft (no inches), and weight kg or lbs with 0.1 step. Each unit select sits inside the same <label> as the number input, so the select has no accessible name. Spin buttons are hidden, there is no min, 0 becomes null, and negatives only fail on the server with a generic message.

## pages/fishing/LogGearPage.tsx
- :47 Server validation (trimmed, 1-120 chars, gear.schema.ts:19-20) isn't mirrored client-side (no maxLength). A whitespace-only name passes 'required' and then fails with the generic toast 'Unable to save gear', with no field error.
- :59 The Add and Edit gear forms have no Cancel or Back link. Leaving means using the nav.
- :64 Gear form fields have no <label> or aria-label. Name and Brand rely on placeholders that disappear once typed, and the Type select has neither label nor placeholder, so screen readers announce unnamed fields.
- :76 Raw inputs and selects use only 'rounded border p-2', with no background, height, text size or focus-visible ring. They look and focus differently from the shadcn Buttons beside them, and the native select has no colour classes for dark mode.
- :97 Save gear isn't disabled while the photo is still uploading (isUploading is internal to the picker), so saving mid-upload creates gear without its image.

## pages/fishing/LogSitePage.tsx
- :37 Latitude or longitude of exactly 0 is saved as null (`Number(latitude) || null`).
- :49 Server validation (name 2 to 120 chars, description max 2000, access notes max 500, coordinate ranges) is not surfaced. There are no maxLength or min/max attributes, and failures show only a generic toast, with no per-field errors.
- :156 Water type options differ between pages: Log site offers only Freshwater and Saltwater, while Edit offers Brackish and Other as well. Detail prints the raw enum ('FRESHWATER').
- :182 Log site and Edit location forms have no cancel or back action. On mobile the full-width submit sits below a 320px map and several fields, with no sticky action.

## pages/fishing/MyCatchesPage.tsx
- :16 The catch list omits what anglers scan for: length and weight are fetched but never rendered, and species isn't requested at all.
- :67 Delete uses the unstyled native window.confirm. The request has no loading state and no error handling (a failed delete gives no feedback), and catch delete offers no undo even though the server only soft-deletes.
- :94 Search inputs have no label or aria-label, no search icon and no clear button. Gear search matches only name, brand and the raw enum; catch search matches only title and site name (not species, dates or notes).
- :132 The catch count isn't pluralised, so a single fish reads '1 catches'.
- :133 caughtAt is rendered with toLocaleString(), showing full date plus time to the second in whatever locale and timezone the browser has (e.g. '9/15/2026, 6:42:13 AM'). Verbose and inconsistent across devices.

## pages/fishing/MyGearPage.tsx
- :26 There are no sort or filter controls: no filter by gear type, and no date range, site or species filter for catches. Order is fixed server-side (gear by createdAt desc, catches by caughtAt desc).
- :73 Deleting gear is a server hard delete that also detaches it from every catch that used it (gear.service.ts:208, many-to-many at schema.prisma:98), but the confirm only asks 'Delete this gear item?' with no warning.
- :87 My gear, My catches and Edit gear have no signed-out branch: signed-out visitors see an empty main area. The unguarded fetch still runs, gets a 401 and shows 'Unable to load your gear/catches', which is inconsistent with Add gear's sign-in prompt.
- :98 Empty states are dead ends. 'No gear found.' / 'No catches found.' is shown both when the angler has nothing and when a search has no matches, with no Add gear or Log catch CTA.
- :109 Gear rows without a photo render no placeholder, so their text shifts left and misaligns with photo rows. Catch rows show a 'No img' box, and thumbnail size and radius differ between the two pages (48px rounded vs 56px rounded-md).
- :117 Similar rows behave differently: the gear name is plain text with no detail view (e.g. catches made with this gear), while the catch title is an underlined link.
- :119 Gear type is shown lowercase in the list ('reel') but title-cased in the form ('Reel'). There is no type badge or icon to scan by category.
- :124 Edit and Delete are size sm (h-8, 32px), below the 44px tap-target guideline, and sit 8px apart. A solid red Delete on every row makes the destructive action the most prominent thing in the list.
- :138 Pagination shows only 'Page X of Y', with no total count and no scroll to top on page change. The list header shows no count either.

## pages/fishing/MySitesPage.tsx
- :67 Delete uses a native window.confirm and has no error handling. A failed delete gives no feedback, and there is no pending state or undo.
- :82 Signed-out users on My locations see an empty page with no sign-in prompt, and the fetch still fires and shows an 'Unable to load your sites' error toast.
- :85 The search input has no label or aria-label, no search icon, and no type='search'.
- :93 One message, 'No locations found.', covers both a brand-new user with zero sites and a search with no matches, with no call to log a site.
- :123 Pluralization and abbreviation in list copy: '1 catches logged', and the 'No img' placeholder.

## pages/fishing/SiteDetailPage.tsx
- :8 Site detail has no likes or reviews at all, though the model has likeCount, reviewCount, Review and SiteLike. There is no API route or UI to like or review a site.
- :35 Site detail and Edit location have no error or not-found handling. A 404, deleted site or network error leaves the bobber loader spinning forever.
- :81 Site detail is a dead end for the owner: no Edit or Delete, no back link to My locations, no 'Log a catch here'. It also never shows who created the site, although createdBy is returned.
- :84 Site detail shows only the first image. There is no gallery or carousel for the other stored photos.
- :99 Site detail prints water type as the raw uppercase enum value, e.g. 'Water type: FRESHWATER'.
- :108 The heading says 'Recent catches at this site', but the section lists every catch, paginated 10 at a time.
- :137 Catch dates render with `new Date(caughtAt).toLocaleString()`, a long browser-locale date-time with seconds. The angler who caught each fish is not shown, though catches at a site can come from any user.
- :154 Catch pagination uses raw buttons with no type, no hover or focus styles and roughly 26px tap targets (px-2 py-1 text-sm). The picker's location button is about 28px (px-3 py-1).
- :177 The map, the page's main location information, sits at the very bottom under the whole paginated catch list. With no coordinates the section disappears with no message.
- :179 'Open map location' opens a new tab with no visual or text cue.

