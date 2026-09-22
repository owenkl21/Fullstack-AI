/*
 * The eight things the Fisherfeed team can call a fish.
 *
 * One table: the name on the chip, the line the picker reads, the sentence the
 * angler is told, the colour of the chip and the ink on it. Everything that
 * draws a badge reads from here, so a badge renamed is renamed once. The
 * drawings themselves are next door in marks.tsx, which keeps this file free
 * of components and the module free to be imported by anything.
 *
 * The colours are the signal tokens the rest of the product already uses
 * (index.css) and nothing new: teal, storm, sun, cold, green, warm, hot, and
 * the black block for the team's own pick. The ink beside each is chosen for
 * contrast against that fill on both themes and written out rather than taken
 * from a token, for the same reason the map pins do it (lib/leaflet.ts): a
 * badge sits on a black card, on paper and on a photograph by turns, and its
 * own two colours must not move with the ground under it.
 */

export const BADGE_KINDS = [
   'GREAT_CATCH',
   'COOL_SPECIES',
   'PERSONAL_BEST',
   'RARE_VISITOR',
   'RELEASED_WELL',
   'YOUNG_ANGLER',
   'CATCH_OF_THE_WEEK',
   'TEAM_PICK',
] as const;

export type BadgeKind = (typeof BADGE_KINDS)[number];

export type BadgeDefinition = {
   name: string;
   /* One line in the picker: what this badge is for. */
   line: string;
   /* What the inbox says, with the fish read in. Follows a name, no full stop. */
   said: (fish: string) => string;
   fill: string;
   ink: string;
};

const PAPER = '#f4f1ec';
const NEAR_BLACK = '#0b0909';

export const BADGES: Record<BadgeKind, BadgeDefinition> = {
   GREAT_CATCH: {
      name: 'Great catch',
      line: 'A fish worth stopping to look at.',
      said: (fish) => `called your ${fish} a great catch`,
      fill: 'var(--teal)',
      ink: '#06232a',
   },
   COOL_SPECIES: {
      name: 'Cool species',
      line: 'Not the one everybody comes home with.',
      said: (fish) => `called your ${fish} a cool species`,
      fill: 'var(--storm)',
      ink: PAPER,
   },
   PERSONAL_BEST: {
      name: 'Personal best',
      line: 'The biggest of this fish they have logged.',
      said: (fish) => `called your ${fish} a personal best`,
      fill: 'var(--sun)',
      ink: '#2a1d02',
   },
   RARE_VISITOR: {
      name: 'Rare visitor',
      line: 'A long way from the water it usually keeps to.',
      said: (fish) => `called your ${fish} a rare visitor`,
      fill: 'var(--cold)',
      ink: PAPER,
   },
   RELEASED_WELL: {
      name: 'Released well',
      line: 'Handled quickly and put back alive.',
      said: (fish) => `said you put your ${fish} back well`,
      fill: 'var(--green)',
      ink: NEAR_BLACK,
   },
   YOUNG_ANGLER: {
      name: 'Young angler',
      line: 'A young one on the rod, and a good fish on the end.',
      said: (fish) => `marked your ${fish} for a young angler`,
      fill: 'var(--warm)',
      ink: NEAR_BLACK,
   },
   CATCH_OF_THE_WEEK: {
      name: 'Catch of the week',
      line: 'The best thing on the feed this week.',
      said: (fish) => `made your ${fish} catch of the week`,
      fill: 'var(--hot)',
      ink: PAPER,
   },
   TEAM_PICK: {
      name: 'Team pick',
      line: 'One the Fisherfeed team pinned up.',
      said: (fish) => `made your ${fish} a team pick`,
      /*
       * The one badge that turns over with the ground, because it is drawn in
       * the ink of whatever it sits on rather than in a colour of its own: the
       * team's pick is the house black block, and the black block inverts at
       * night (index.css) or it disappears into the page. Ink on ground is
       * exactly that inversion, on a card, on paper and in the picker alike.
       */
      fill: 'var(--ink)',
      ink: 'var(--bg)',
   },
};

export const isBadgeKind = (value: string): value is BadgeKind =>
   (BADGE_KINDS as readonly string[]).includes(value);

/*
 * Only the badges this build knows how to draw.
 *
 * A ninth badge is one enum value on the server and one drawing here, and the
 * two do not reach a browser at the same moment: the app is installed, so a
 * phone can still be holding yesterday's bundle when the server starts handing
 * out a kind it has never heard of. Leaving that one out draws one badge
 * fewer; looking its colour up blindly took the whole feed down with it.
 */
export const knownBadges = <T extends { kind: string }>(badges: T[]) =>
   badges.filter((badge) => badge.kind in BADGES);
