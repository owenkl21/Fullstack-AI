repo: owenkl21/fishlogger
branch: main
path: packages/client

## Last sync
date: 2026-09-19T13:33:41Z

### Updated in this project
- Redesign frames for the quick log (merged with the long form), the feed card and competitions
- Brand fonts, mark and photos copied into assets/
- Contours and waterline art ported to assets/brand-art.js

## Screen map
| Screen | Repo files |
| --- | --- |
| Quick Log.dc.html | packages/client/src/pages/fishing/QuickLogPage.tsx, packages/client/src/pages/fishing/LogCatchPage.tsx, packages/client/src/components/fishing/quicklog/*, packages/client/src/components/fishing/SpeciesGuess.tsx, packages/client/src/components/fishing/MapLocationPicker.tsx, packages/client/src/components/fishing/CompetitionEntryFields.tsx |
| Feed Card.dc.html | packages/client/src/pages/fishing/FeedPage.tsx, packages/client/src/components/feed/FeedPostBlock.tsx, packages/client/src/components/feed/CommentThread.tsx, packages/client/src/components/brand/PageHead.tsx |
| Competitions.dc.html | packages/client/src/pages/social/CompetitionsPage.tsx, packages/client/src/pages/social/CompetitionPage.tsx, packages/client/src/pages/social/NewCompetitionPage.tsx, packages/client/src/components/social/StandingsTable.tsx |
| Fishtagram Rework.dc.html | docs/redesign/15-design-brief-pages.md |
| assets/brand-art.js | packages/client/src/components/brand/Contours.tsx, packages/client/src/components/brand/TornEdge.tsx, packages/client/src/components/brand/path.ts |
| Shell chrome in all frames | packages/client/src/components/shell/AppHeader.tsx, packages/client/src/components/shell/BottomBar.tsx, packages/client/src/components/ui/button.tsx |
