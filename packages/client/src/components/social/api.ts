import axios from 'axios';

/* The social layer as the client sees it. Shapes mirror the server exactly. */

export type Standing = {
   anglerId: string;
   displayName: string;
   username: string | null;
   points: number;
   qualifyingCount: number;
   totalMassKg: number;
   distinctSpecies: number;
   longestCm: number;
   /* On a species board: the angler's heaviest fish, null for one never
      weighed nor measured against figures, and whether it was estimated. */
   bestMassKg?: number | null;
   bestEstimated?: boolean;
   /* The heaviest weight that was not checked by a scale photo: shown under
      the ranked ones, not ranked. */
   unverifiedKg?: number | null;
};

export type SpeciesBoard = {
   speciesId: string;
   commonName: string;
   standings: Standing[];
   longestCm: number;
   longestBy: string | null;
   longestByName: string | null;
   /* The heaviest fish on the board, and who caught it. */
   heaviestKg?: number | null;
   heaviestEstimated?: boolean;
   heaviestByName?: string | null;
   anglers: number;
   /*
    * A board can be empty for two different reasons and the screen has to be
    * able to tell them apart: nobody caught one, or the species has no
    * published figures to score against.
    */
   loggedButUnscored: number;
   unscoredReason: string | null;
};

export type RivalStanding = Standing & {
   avatarUrl: string | null;
   isYou: boolean;
};

export type ProfileStats = {
   catches: number;
   distinctSpecies: number | null;
   daysOnTheWater: number;
   releasedCount: number;
   longestCm: number | null;
   points: number;
   qualifyingCatches: number;
   unscored: number;
   /* Null until something has happened more than once. */
   favouriteSpecies: { name: string; count: number } | null;
   favouriteSpot: { name: string; count: number } | null;
   bestDay: { date: string; count: number } | null;
};

export type PersonalBest = {
   speciesId: string;
   commonName: string;
   /* Judged on its weight, or on its length for a species never weighed. */
   by: 'WEIGHT' | 'LENGTH';
   weightKg: number | null;
   /* Only SCALE is a weighed fish; the others are estimates. */
   weightSource: 'SCALE' | 'EYE' | 'LENGTH' | null;
   lengthCm: number | null;
   caughtAt: string;
   catchId: string;
   title: string;
   count: number;
};

/** Your best fish of each species, weight first. */
export async function fetchPersonalBests(signal?: AbortSignal) {
   const { data } = await axios.get<{ personalBests: PersonalBest[] }>(
      '/api/stats/bests',
      { signal }
   );
   return data.personalBests;
}

export async function fetchSpeciesBoards(signal?: AbortSignal) {
   const { data } = await axios.get<{ boards: SpeciesBoard[] }>(
      '/api/competitions/species',
      { signal }
   );
   return data.boards;
}

export async function fetchRivals(signal?: AbortSignal) {
   const { data } = await axios.get<{
      standings: RivalStanding[];
      mutualCount: number;
   }>('/api/stats/rivals', { signal });
   return data;
}

export async function fetchMyStats(signal?: AbortSignal) {
   const { data } = await axios.get<{
      stats: ProfileStats;
      personalBests: PersonalBest[];
   }>('/api/stats/me', { signal });
   return data;
}
