import { prisma } from './prisma';

/*
 * Keeping the language on Fisherfeed fit to read.
 *
 * Two lists, two treatments. Swearing is masked: the first letter stays and the
 * rest becomes stars, so "that was f*** lekker" still says what it meant and the
 * post still goes up. Slurs are refused outright: there is no version of one
 * worth masking, and a masked slur still says what it is.
 *
 * It runs on the server, in the schemas, so there is no way round it by
 * calling the API directly, and it runs on every field somebody else will read:
 * posts, comments, catch titles and notes, spot names and descriptions,
 * reviews, competition and team names, display names and bios.
 *
 * Matching is by whole word, after undoing the usual dodges: capitals, numbers
 * standing in for letters (sh1t), symbols (@ss), and a letter held down three
 * times or more (fuuuck). Whole words is the point. A filter that matches
 * inside words blanks "cocktail" and "Scunthorpe", and in Afrikaans it would
 * blank "fokus", which is just the word for focus. A word ending in * in a list
 * also matches anything that starts with it (fuck* takes fucking and fucker),
 * and is kept for the few stems where that cannot catch an innocent word.
 *
 * The lists live in the database so the team can edit them from the admin panel
 * without a deploy. They are held in memory, read at boot and again whenever
 * the team saves, because the schemas that use them run on every request and
 * cannot wait on a query.
 */

export type WordLists = { mask: string[]; block: string[] };

const SETTING_KEY = 'moderation-words';

export const DEFAULT_WORDS: WordLists = {
   mask: [
      /*
       * English. Dick is left off: it is somebody's name. So are words that
       * are also a fish or an angler's word: bastard (bastard mullet,
       * bastard grunter), cock (a cock fish) and prick.
       */
      'fuck*',
      'motherfuck*',
      'shit*',
      'bullshit*',
      'cunt*',
      'bitch*',
      'asshole*',
      'arsehole*',
      'dickhead*',
      'wanker*',
      'twat*',
      'bollocks',
      'pussy',
      'slut*',
      'whore*',
      'piss',
      /* Not a stem: retard* would take "fire retardant". */
      'retard',
      'retards',
      'retarded',
      /*
       * Afrikaans and South African English, kept to words with no innocent
       * meaning. Moer (as in moerse vis), naai (to sew), gat (a hole) and doos
       * (a box, as in a box of worms) are left alone on purpose.
       */
      'fok',
      'fokken',
      'fokkin',
      'fokkol',
      'fokof',
      'fokop',
      'fokker',
      'fokkers',
      'poes',
      'poese',
      'kak',
      'kakhuis',
   ],
   block: [
      'kaffir*',
      'kaffer*',
      'nigger*',
      'nigga*',
      'hotnot*',
      'coon',
      'coons',
      'faggot*',
      'paki',
      'pakis',
      'kike',
      'kikes',
      'wetback*',
      /* chink and spic are left off on purpose: "a chink in the armour" and
         "spic and span" are ordinary English, and refusing them does harm.
         So is fag, which is a cigarette to half the country. */
   ],
};

let current: WordLists = DEFAULT_WORDS;

/* Numbers and symbols standing in for letters, the usual way round a filter. */
const STAND_INS: Record<string, string> = {
   '0': 'o',
   '1': 'i',
   '3': 'e',
   '4': 'a',
   '5': 's',
   '7': 't',
   '@': 'a',
   $: 's',
   '!': 'i',
};

/* A word as the filter compares it: lower case, stand-ins undone. */
const flatten = (word: string) =>
   word
      .toLowerCase()
      .split('')
      .map((c) => STAND_INS[c] ?? c)
      .join('');

const REPEATS = new RegExp('(.)\\1+', 'g');
const HELD_DOWN = new RegExp('(.)\\1\\1');

/*
 * Held-down letters let go, for a second reading. Only ever used on a word
 * that has three of a letter in a row, because doubles are ordinary spelling:
 * letting go of every double would read "dos" as "doos".
 */
const letGo = (flat: string) => flat.replace(REPEATS, '$1');
const heldDown = (flat: string) => HELD_DOWN.test(flat);

type Matcher = {
   exact: Set<string>;
   stems: string[];
   /* The same entries with their doubles let go, for a held-down word. */
   exactLoose: Set<string>;
   stemsLoose: string[];
};

const compile = (list: string[]): Matcher => {
   const exact = new Set<string>();
   const stems: string[] = [];
   for (const raw of list) {
      const entry = raw.trim();
      if (!entry) continue;
      if (entry.endsWith('*')) stems.push(flatten(entry.slice(0, -1)));
      else exact.add(flatten(entry));
   }
   return {
      exact,
      stems,
      exactLoose: new Set([...exact].map(letGo)),
      stemsLoose: stems.map(letGo),
   };
};

let maskMatcher = compile(current.mask);
let blockMatcher = compile(current.block);

const hits = (matcher: Matcher, flat: string) => {
   if (matcher.exact.has(flat) || matcher.stems.some((s) => flat.startsWith(s)))
      return true;
   if (!heldDown(flat)) return false;
   const loose = letGo(flat);
   return (
      matcher.exactLoose.has(loose) ||
      matcher.stemsLoose.some((s) => loose.startsWith(s))
   );
};

/*
 * A word, for the filter's purposes: letters, and the digits and symbols that
 * stand in for them. Apostrophes are left out so "don't" is two harmless parts.
 */
const WORD = /[\p{L}0-9@$!]+/gu;

export type Moderated = { text: string; blocked: boolean; masked: number };

/** Mask the swearing and say whether a slur was found. */
export function moderate(text: string): Moderated {
   let blocked = false;
   let masked = 0;
   const out = text.replace(WORD, (whole) => {
      /*
       * An exclamation mark stands in for an i only inside a word (sh!t). At
       * either end it is punctuation: read as letters, "Pak!" was a slur and
       * "Nice!!!" had a letter held down. It is kept out of the reading and
       * put back after.
       */
      const lead = /^!+/.exec(whole)?.[0] ?? '';
      const trail = /!+$/.exec(whole.slice(lead.length))?.[0] ?? '';
      const word = whole.slice(lead.length, whole.length - trail.length);
      /* A run of symbols alone, or a single letter, is never a word worth
         reading into. */
      if (word.length < 2 || !/\p{L}/u.test(word)) return whole;
      const flat = flatten(word);
      if (hits(blockMatcher, flat)) {
         blocked = true;
         return whole;
      }
      if (hits(maskMatcher, flat)) {
         masked += 1;
         return (
            lead + word[0] + '*'.repeat(Math.max(word.length - 1, 2)) + trail
         );
      }
      return whole;
   });
   return { text: out, blocked, masked };
}

/** What a refused piece of writing is told, in the app's own words. */
export const REFUSED_WORDING =
   'That has a word in it that is not allowed on Fisherfeed. Take it out and try again.';

type IssueSink = {
   addIssue: (issue: { code: 'custom'; message: string }) => void;
};

/*
 * The zod side of it, so a schema only has to say which fields are read by
 * other people. Masks in place, and refuses with REFUSED_WORDING.
 */
export const cleanTransform = (value: string, ctx: IssueSink) => {
   const result = moderate(value);
   if (result.blocked) {
      ctx.addIssue({ code: 'custom', message: REFUSED_WORDING });
   }
   return result.text;
};

export const cleanOptional = <T extends string | null | undefined>(
   value: T,
   ctx: IssueSink
): T => (typeof value === 'string' ? (cleanTransform(value, ctx) as T) : value);

const tidy = (list: unknown): string[] =>
   Array.isArray(list)
      ? [
           ...new Set(
              list
                 .filter((entry): entry is string => typeof entry === 'string')
                 .map((entry) => entry.trim().toLowerCase())
                 .filter((entry) => entry.length >= 2 && entry.length <= 40)
           ),
        ].sort()
      : [];

const apply = (lists: WordLists) => {
   current = lists;
   maskMatcher = compile(lists.mask);
   blockMatcher = compile(lists.block);
};

export const moderationWords = {
   /** The lists in force now. */
   read: (): WordLists => current,

   /** Read the saved lists, if any, at boot. Quiet on failure: the defaults stand. */
   async load() {
      try {
         const row = await prisma.serverSetting.findUnique({
            where: { key: SETTING_KEY },
            select: { value: true },
         });
         if (!row) return;
         const saved = JSON.parse(row.value) as Partial<WordLists>;
         apply({ mask: tidy(saved.mask), block: tidy(saved.block) });
      } catch (error) {
         console.warn(
            '[moderation] Could not read the word lists; using the defaults.',
            error
         );
      }
   },

   /** Save the team's lists and use them at once. */
   async save(lists: { mask: unknown; block: unknown }): Promise<WordLists> {
      const next = { mask: tidy(lists.mask), block: tidy(lists.block) };
      await prisma.serverSetting.upsert({
         where: { key: SETTING_KEY },
         update: { value: JSON.stringify(next) },
         create: { key: SETTING_KEY, value: JSON.stringify(next) },
      });
      apply(next);
      return next;
   },

   /** Put the built-in lists back. */
   async reset(): Promise<WordLists> {
      await prisma.serverSetting.deleteMany({ where: { key: SETTING_KEY } });
      apply(DEFAULT_WORDS);
      return DEFAULT_WORDS;
   },
};
