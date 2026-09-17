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
};

export type SpeciesBoard = {
   speciesId: string;
   commonName: string;
   standings: Standing[];
   longestCm: number;
   longestBy: string | null;
   longestByName: string | null;
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
};

export type PersonalBest = {
   speciesId: string;
   commonName: string;
   lengthCm: number;
   caughtAt: string;
   catchId: string;
   title: string;
};

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
