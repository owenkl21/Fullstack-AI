import axios from 'axios';

/*
 * How far an angler has come: the rank, what earned it, and the badges. The
 * arithmetic lives on the server so everyone sees the same rank for the same
 * log; this is only the shape it comes down in.
 */

export type Rank = { index: number; name: string; minPoints: number };

export type Breakdown = {
   key: string;
   label: string;
   points: number;
   detail: string;
};

export type Badge = {
   key: string;
   name: string;
   how: string;
   earned: boolean;
   progress: number;
};

export type Progress = {
   points: number;
   rank: Rank;
   next: Rank | null;
   progress: number;
   breakdown: Breakdown[];
   badges: Badge[];
   figures: {
      catches: number;
      fish: number;
      species: number;
      spots: number;
      rangeKm: number;
      days: number;
      released: number;
      photographed: number;
      biggestCm: number | null;
   };
};

export async function fetchMyProgress(signal?: AbortSignal) {
   const { data } = await axios.get<{ progress: Progress }>(
      '/api/stats/progress',
      { signal }
   );
   return data.progress;
}

export async function fetchProgressOf(userId: string, signal?: AbortSignal) {
   const { data } = await axios.get<{ progress: Progress }>(
      `/api/users/${userId}/progress`,
      { signal }
   );
   return data.progress;
}
