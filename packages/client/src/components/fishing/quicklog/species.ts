import axios from 'axios';
import type { CatchSummary } from '@/components/fishing/record/api';

/*
 * Naming the fish in the fast log.
 *
 * This used to offer the titles of previous catches as if they were species,
 * and saved whatever was chosen as a title and nothing else. A catch logged
 * that way carried no species, so it could never be scored: the boards, the
 * personal bests and the species count on a profile all read from the species
 * on a catch, and the fast path is how most catches get logged.
 *
 * So the chips are real species now, resolved to a real id before saving.
 */

export type Species = {
   id: string;
   commonName: string;
   scientificName: string;
   aliases: string[];
};

export const NOT_SURE = 'Not sure';

/* Case, spaces and punctuation do not make a different fish. */
export const speciesKey = (name: string) =>
   name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The fallback title when the angler could not name the fish. */
export const UNNAMED_TITLE = 'Catch';

/*
 * What a South African shore angler is most likely to be holding, for someone
 * whose log is still empty. Every name here is matched against the species the
 * server actually returned, so a name that has not been seeded is never offered.
 */
const STARTERS = ['Elf', 'Galjoen', 'Dusky kob', 'Blacktail', 'Bronze bream'];

export async function fetchSpecies(signal?: AbortSignal): Promise<Species[]> {
   const { data } = await axios.get<Species[]>('/api/species', { signal });
   return Array.isArray(data) ? data : [];
}

const key = (name: string) => name.trim().toLowerCase();

/** Find the species an angler means, by common name first and then by alias. */
export function matchSpecies(name: string, species: Species[]): Species | null {
   const k = key(name);
   if (!k) {
      return null;
   }

   return (
      species.find((s) => key(s.commonName) === k) ??
      species.find((s) => key(s.scientificName) === k) ??
      species.find((s) => (s.aliases ?? []).some((a) => key(a) === k)) ??
      null
   );
}

/**
 * The chips: the species this angler has logged, most recent first, topped up
 * with common shore fish so the row is never empty on a first catch.
 */
export function speciesChoices(
   catches: CatchSummary[],
   species: Species[],
   limit = 5
): string[] {
   const seen = new Set<string>();
   const names: string[] = [];

   const take = (name: string | undefined | null) => {
      if (!name || names.length >= limit) {
         return;
      }
      const k = key(name);
      if (!k || seen.has(k)) {
         return;
      }
      seen.add(k);
      names.push(name);
   };

   [...catches]
      .sort(
         (a, b) =>
            new Date(b.caughtAt).getTime() - new Date(a.caughtAt).getTime()
      )
      .forEach((entry) => take(entry.species?.commonName));

   /* Only starters the server actually knows about. */
   STARTERS.forEach((name) => take(matchSpecies(name, species)?.commonName));

   return names;
}
