import type { CatchSummary } from '@/components/fishing/record/api';

/*
 * A catch has no species field yet, so the fish is named by the record's title.
 * The chips are the names this angler has actually used, most recent first.
 */
// TODO(api): appendix E, no species on a catch; the species chosen in the fast log
// is saved as the title until the field exists.

export const NOT_SURE = 'Not sure';

/** The fallback title when the angler could not name the fish. */
export const UNNAMED_TITLE = 'Catch';

export function recentSpecies(catches: CatchSummary[], limit = 5) {
   const seen = new Set<string>();
   const names: string[] = [];

   [...catches]
      .sort(
         (a, b) =>
            new Date(b.caughtAt).getTime() - new Date(a.caughtAt).getTime()
      )
      .forEach((entry) => {
         const name = entry.title.trim();
         const key = name.toLowerCase();
         if (!name || key === UNNAMED_TITLE.toLowerCase() || seen.has(key)) {
            return;
         }
         seen.add(key);
         if (names.length < limit) {
            names.push(name);
         }
      });

   return names;
}
