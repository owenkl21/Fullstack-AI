import axios from 'axios';
import type { BadgeKind } from '@/components/badges/kinds';

/*
 * A badge as every endpoint that carries one hands it over: the feed post, the
 * catch record, a row in the log. Awarding and taking one off are admin only
 * and answer 404 to anybody else, which is why nothing here asks first: the
 * control that calls these is only ever drawn for an admin, and the server is
 * what actually decides.
 */
export type CatchBadge = {
   id: string;
   kind: BadgeKind;
   note: string | null;
   createdAt: string;
   awardedBy: {
      id: string;
      displayName: string;
      username: string | null;
   } | null;
};

export async function awardBadge(
   catchId: string,
   kind: BadgeKind,
   note?: string | null
) {
   const { data } = await axios.post<{ badge: CatchBadge; created: boolean }>(
      `/api/catches/${catchId}/badges`,
      { kind, note: note?.trim() || null }
   );
   return data.badge;
}

export async function removeBadge(catchId: string, kind: BadgeKind) {
   await axios.delete(`/api/catches/${catchId}/badges/${kind}`);
}
