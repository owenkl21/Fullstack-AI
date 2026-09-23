import axios from 'axios';

/*
 * The admin panel's readings, one section at a time.
 *
 * Six calls rather than one, so the headline paints while the slow sections are
 * still counting, and a section that falls over takes only its own panel down.
 *
 * Nothing here decides whether the reader is an admin. The server does, on
 * every request, from the role on the row behind the session; a caller who is
 * not the admin gets the same 404 a path that was never registered gives, and
 * the page reads that as "not for you". There is deliberately no flag in this
 * file to be wrong about.
 */

export type Section =
   | 'overview'
   | 'growth'
   | 'fish'
   | 'water'
   | 'people'
   | 'health';

export type Reading<T> = {
   section: Section;
   generatedAt: string;
   /* How long the server took to count it. Shown on the page. */
   ms: number;
   data: T;
};

export type Figure = {
   key: string;
   label: string;
   total: number;
   d7: number;
   d30: number;
};

export type Overview = { figures: Figure[] };

export type DayCount = { day: string; count: number };

export type Growth = {
   daily: { signUps: DayCount[]; catches: DayCount[]; photos: DayCount[] };
   weekly: { signUps: DayCount[]; catches: DayCount[]; photos: DayCount[] };
   caughtByDay: DayCount[];
};

export type SpeciesRow = {
   id: string;
   name: string;
   logs: number;
   fish: number;
   longestCm: number | null;
   longestBy: string | null;
   heaviestKg: number | null;
   heaviestBy: string | null;
};

export type Fish = {
   species: SpeciesRow[];
   months: { month: string; count: number }[];
   keep: { released: number; kept: number };
   lengths: { bucket: number; count: number }[];
   weights: { bucket: number; count: number }[];
};

export type SpotRow = {
   id: string;
   name: string;
   waterType: string | null;
   visibility: string;
   catches: number;
   reviews: number;
   likes: number;
   placed: boolean;
   owner: string | null;
   ownerHandle: string | null;
};

export type Water = {
   spots: SpotRow[];
   waterTypes: { key: string; count: number }[];
   provinces: { name: string; count: number }[];
   visibility: { key: string; count: number }[];
};

export type ActiveAngler = {
   id: string;
   displayName: string;
   username: string | null;
   email: string;
   verified: boolean;
   joinedAt: string;
   catches: number;
   spots: number;
   comments: number;
   followers: number;
   following: number;
};

export type JoinedAngler = {
   id: string;
   displayName: string;
   username: string | null;
   email: string;
   emailVerified?: boolean;
   joinedAt: string;
};

export type People = {
   active: ActiveAngler[];
   lately: JoinedAngler[];
   noHandle: JoinedAngler[];
   noCatch: JoinedAngler[];
   counts: { noHandle: number; noCatch: number; unverified: number };
};

export type Health = {
   photos: {
      total: number;
      d7: number;
      d30: number;
      onCatches: number;
      onSpots: number;
      /* False, and said out loud on the page: no byte size is stored. */
      bytesKnown: boolean;
   };
   competitions: { key: string; count: number }[];
   entries: {
      total: number;
      judged: number;
      byState: { key: string; count: number }[];
      unchecked: { reason: string; count: number }[];
   };
   push: { kind: string; count: number }[];
   mail: {
      transport: string | null;
      domain: string | null;
      recent: {
         kind: string;
         to: string;
         sentAt: string;
         state: string;
      }[];
   };
   build: { deployment: string | null; claude: string };
   reference: { species: number; feedPosts: number };
};

/*
 * A refusal the page has to tell apart from a failure. The guard answers 404
 * for a stranger, for an ordinary angler and for a path that does not exist,
 * all alike, so "not found" is the only thing a client can be told and the
 * only thing it needs.
 */
export class NotForYou extends Error {
   constructor() {
      super('not for you');
      this.name = 'NotForYou';
   }
}

export async function fetchSection<T>(
   section: Section,
   signal?: AbortSignal
): Promise<Reading<T>> {
   try {
      const { data } = await axios.get<Reading<T>>(`/api/admin/${section}`, {
         signal,
      });
      return data;
   } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
         throw new NotForYou();
      }
      throw error;
   }
}

/* The tick, given or taken by hand. Answers whether it will hold: an address
   on the team's own list settles itself again the next time it is used. */
export async function setVerified(userId: string, verified: boolean) {
   const { data } = await axios.post<{
      id: string;
      verified: boolean;
      displayName: string;
      fromAddress: boolean;
   }>(`/api/admin/users/${userId}/verified`, { verified });
   return data;
}
