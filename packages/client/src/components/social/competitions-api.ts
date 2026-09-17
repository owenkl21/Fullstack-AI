import axios from 'axios';

/* The competitions an angler runs or enters. Figures are metric on the wire. */

export type CompetitionMeasure = 'LENGTH' | 'WEIGHT';
export type CompetitionRule =
   | 'SPECIES_POINTS'
   | 'BIGGEST_FISH'
   | 'SPECIES_VARIETY';

export type Competition = {
   id: string;
   name: string;
   blurb: string | null;
   rule: CompetitionRule;
   measure: CompetitionMeasure;
   scope: 'PUBLIC' | 'GROUP' | 'PRIVATE';
   startsAt: string;
   endsAt: string;
   maxPerSpeciesPerDay: number;
   speciesId: string | null;
   species: { id: string; commonName: string } | null;
   createdBy: { id: string; displayName: string; username: string | null };
   entrantCount: number;
   youEntered: boolean;
   youOrganise?: boolean;
   status: 'upcoming' | 'running' | 'finished';
};

export type CompetitionStanding = {
   anglerId: string;
   displayName: string;
   username: string | null;
   total: number;
   best: number;
   entries: number;
   distinctSpecies: number;
};

export async function fetchCompetitions(
   signal?: AbortSignal,
   page = 1
): Promise<{
   items: Competition[];
   total: number;
   page: number;
   size: number;
}> {
   const { data } = await axios.get<{
      competitions: Competition[];
      total: number;
      page: number;
      size: number;
   }>('/api/competitions', { params: { page }, signal });
   return {
      items: data.competitions,
      total: data.total,
      page: data.page,
      size: data.size,
   };
}

export async function fetchStandings(id: string, signal?: AbortSignal) {
   const { data } = await axios.get<{
      competition: Competition;
      standings: CompetitionStanding[];
   }>(`/api/competitions/${id}/standings`, { signal });
   return data;
}

export type NewCompetition = {
   name: string;
   blurb?: string | null;
   rule: CompetitionRule;
   measure: CompetitionMeasure;
   scope: 'PUBLIC' | 'GROUP' | 'PRIVATE';
   inviteeIds?: string[];
   speciesId?: string | null;
   startsAt: string;
   endsAt: string;
   maxPerSpeciesPerDay?: number;
};

export async function createCompetition(input: NewCompetition) {
   const { data } = await axios.post<{ competition: Competition }>(
      '/api/competitions',
      input
   );
   return data.competition;
}

export const enterCompetition = (id: string) =>
   axios.post(`/api/competitions/${id}/join`);

export const leaveCompetition = (id: string) =>
   axios.delete(`/api/competitions/${id}/join`);

/** The rule in the words an angler would use for it. */
export const ruleSentence = (
   rule: CompetitionRule,
   measure: CompetitionMeasure
) => {
   const unit = measure === 'LENGTH' ? 'length' : 'weight';
   if (rule === 'BIGGEST_FISH') {
      return `Biggest single fish by ${unit}`;
   }
   if (rule === 'SPECIES_VARIETY') {
      return 'Most different species';
   }
   return `Total ${unit} of every fish that counts`;
};

export type Invite = {
   id: string;
   expiresAt: string;
   invitedBy: { id: string; displayName: string; username: string | null };
   competition: Competition;
};

export type Follower = {
   id: string;
   displayName: string;
   username: string | null;
   avatarUrl: string | null;
};

export async function fetchInvites(signal?: AbortSignal) {
   const { data } = await axios.get<{ invites: Invite[] }>(
      '/api/competitions/invites',
      { signal }
   );
   return data.invites;
}

export async function answerInvite(inviteId: string, accept: boolean) {
   const { data } = await axios.post<{ state: string }>(
      `/api/competitions/invites/${inviteId}`,
      { accept }
   );
   return data;
}

export async function fetchMyFollowers(signal?: AbortSignal) {
   const { data } = await axios.get<{ followers: Follower[] }>(
      '/api/users/me/followers',
      { signal }
   );
   return data.followers;
}

export async function inviteToCompetition(
   competitionId: string,
   userIds: string[]
) {
   const { data } = await axios.post<{ sent: number }>(
      `/api/competitions/${competitionId}/invite`,
      { userIds }
   );
   return data;
}

/*
 * How long until it closes, in the words a clock on a wall would use. Days
 * once there are days, hours and minutes when it is close, and nothing
 * fancier: a countdown that ticks seconds is a game show.
 */
export function timeLeft(endsAt: string, now = Date.now()) {
   const ms = new Date(endsAt).getTime() - now;
   if (ms <= 0) return 'Closed';
   const minutes = Math.floor(ms / 60000);
   const hours = Math.floor(minutes / 60);
   const days = Math.floor(hours / 24);
   if (days >= 2) return `${days} days left`;
   if (hours >= 1) return `${hours} h ${minutes % 60} min left`;
   return `${minutes} min left`;
}
