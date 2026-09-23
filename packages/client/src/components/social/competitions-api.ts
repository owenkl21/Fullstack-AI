import axios from 'axios';
import {
   formatClock,
   formatDay,
   formatDayMonth,
   toDate,
} from '@/components/fishing/record/format';
import { formatMeasure, type UnitChoice } from '@/lib/units';

/*
 * The competitions an angler runs or enters. Figures are metric on the wire.
 *
 * A competition is a list row, a page of its own, and a set of entries, each
 * of which is a catch frozen at the moment it was entered together with the
 * report of what was checked about it. Everything the client knows about
 * those three things is typed here, once.
 */

export type CompetitionMeasure = 'LENGTH' | 'WEIGHT';
export type CompetitionRule =
   | 'SPECIES_POINTS'
   | 'BIGGEST_FISH'
   | 'SPECIES_VARIETY';
export type CompetitionScope = 'PUBLIC' | 'GROUP' | 'PRIVATE';
export type CompetitionChecks = 'CASUAL' | 'REVIEW';
export type CompetitionArea = 'ANYWHERE' | 'WATERBODY' | 'REGION';
export type CompetitionStatus = 'upcoming' | 'running' | 'finished';

export type Competition = {
   id: string;
   name: string;
   blurb: string | null;
   rule: CompetitionRule;
   measure: CompetitionMeasure;
   scope: CompetitionScope;
   checks: CompetitionChecks;
   areaType: CompetitionArea;
   areaName: string | null;
   /* Where the waterbody is and how far from it still counts. */
   areaLatitude?: number | null;
   areaLongitude?: number | null;
   areaRadiusKm?: number | null;
   startsAt: string;
   endsAt: string;
   timeZoneId?: string;
   maxPerSpeciesPerDay: number;
   /* The older single column. Read `species` instead. */
   speciesId: string | null;
   /* Every fish it is for, by name. Empty means any species. */
   species: CompetitionSpecies[];
   createdBy: { id: string; displayName: string; username: string | null };
   entrantCount: number;
   entryCount?: number;
   youEntered: boolean;
   youOrganise?: boolean;
   status: CompetitionStatus;
   /* The catch out in front, when a counted entry exists. */
   leading?: {
      displayName: string;
      value: number;
      speciesName: string | null;
   } | null;
   /* The viewer's own pending invitation, when there is one. */
   invite?: { id: string; expiresAt: string } | null;
   /* Teams: on or off, how many a side may hold, and the viewer's side. */
   teamsEnabled?: boolean;
   maxPerTeam?: number | null;
   yourTeamId?: string | null;
};

/* Somebody on a side, as the roster names them. */
export type TeamMember = {
   id: string;
   displayName: string;
   username: string | null;
   verified?: boolean;
};

export type CompetitionTeam = {
   id: string;
   name: string;
   position: number;
   members: TeamMember[];
};

export type TeamStanding = {
   teamId: string;
   name: string;
   place: number;
   joint: boolean;
   score: number;
   members: number;
   scoring: number;
   best: {
      value: number;
      displayName: string;
      speciesName: string | null;
   } | null;
   distinctSpecies: number;
};

/* One fish a competition is for. */
export type CompetitionSpecies = {
   id: string;
   commonName: string;
   scientificName: string | null;
};

export type CompetitionStanding = {
   place: number;
   joint: boolean;
   anglerId: string;
   displayName: string;
   username: string | null;
   score: number;
   bestValue: number | null;
   bestSpeciesName: string | null;
   entries: number;
   distinctSpecies: number;
};

export type EntryState = 'PENDING' | 'COUNTED' | 'HELD' | 'EXCLUDED';
export type CheckCode =
   | 'fish'
   | 'species'
   | 'figure'
   | 'window'
   | 'area'
   | 'duplicate';
export type EntryCheck = {
   code: CheckCode;
   status: 'pass' | 'flag' | 'skip';
   detail: string;
};

export type CompetitionEntry = {
   id: string;
   anglerId: string;
   displayName: string;
   username: string | null;
   speciesName: string | null;
   value: number | null;
   declaredValue: number | null;
   readValue: number | null;
   readConfidence: number | null;
   state: EntryState;
   flags: string[];
   report: EntryCheck[];
   caughtAt: string;
   note: string | null;
   heroUrl: string | null;
   /* How the angler framed the fish photograph (lib/framing.ts), so a small
      square keeps what the feed keeps. Null when it was never framed. */
   heroFraming?: {
      focusX: number | null;
      focusY: number | null;
      zoom: number | null;
   } | null;
   measureUrl: string | null;
   areaConfirmed: boolean;
   flaggedBy: string | null;
   flagReason: string | null;
   reviewNote: string | null;
   yours: boolean;
   canReview: boolean;
   canFlag: boolean;
   createdAt: string;
   /* What the judge made of it, cut by the server to who is looking. */
   judge?: JudgeView | null;
};

export type JudgeYesNo = 'yes' | 'no' | 'unsure';

/*
 * The judge's findings. The organiser gets all of it; the angler gets the
 * one sentence written for them; anybody else gets nothing (null).
 */
export type JudgeView =
   | {
        status: 'checked';
        audience: 'organiser';
        overall: 'accept' | 'review' | 'reject';
        holds: boolean;
        organiserNote: string;
        anglerNote: string;
        reading: {
           value: number | null;
           unit: 'cm' | 'in' | 'kg' | 'lb' | null;
           confidence: number;
           seen: 'tape' | 'board' | 'scale' | 'none';
        };
        fishOnMeasure: JudgeYesNo;
        sameFish: JudgeYesNo;
        species: { plausible: JudgeYesNo; bestGuess: string | null };
        tamperSigns: {
           kind: 'screen' | 'edited_digits' | 'lighting' | 'other';
           detail: string;
        }[];
        checks: {
           check: CheckCode;
           verdict: 'pass' | 'fail' | 'unsure';
           reason: string;
        }[];
        model: string | null;
        at: string | null;
     }
   | { status: 'checked'; audience: 'angler'; anglerNote: string }
   | { status: 'unchecked'; audience: 'organiser'; reason: string };

export type CompetitionDetail = {
   competition: Competition;
   standings: CompetitionStanding[];
   /* Null for a competition without teams. */
   teams?: { teams: CompetitionTeam[]; unassigned: TeamMember[] } | null;
   teamStandings?: TeamStanding[] | null;
   entries: CompetitionEntry[];
   you: {
      entered: boolean;
      organise: boolean;
      invite: { id: string; expiresAt: string } | null;
   };
};

export type CompetitionTab = 'all' | 'mine' | 'invites';

/*
 * A competition as it came off the wire, made safe to read. `species` is a
 * list now and was one fish or null before, and for the minutes a deploy
 * takes a page can be talking to a server a version away from it. Read here,
 * once, so nothing that draws a competition has to wonder which it got.
 */
function readCompetition<T extends { species?: unknown }>(
   raw: T
): T & { species: CompetitionSpecies[] } {
   const was = raw.species;
   const species = Array.isArray(was)
      ? (was as CompetitionSpecies[])
      : was && typeof was === 'object'
        ? [{ scientificName: null, ...(was as object) } as CompetitionSpecies]
        : [];
   return { ...raw, species };
}

export async function fetchCompetitions(
   signal?: AbortSignal,
   page = 1,
   tab: CompetitionTab = 'all'
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
   }>('/api/competitions', { params: { page, tab }, signal });
   return {
      items: data.competitions.map(readCompetition),
      total: data.total,
      page: data.page,
      size: data.size,
   };
}

export async function fetchCompetition(
   id: string,
   signal?: AbortSignal
): Promise<CompetitionDetail> {
   const { data } = await axios.get<CompetitionDetail>(
      `/api/competitions/${id}`,
      { signal }
   );
   return { ...data, competition: readCompetition(data.competition) };
}

export type NewCompetition = {
   name: string;
   blurb?: string | null;
   rule: CompetitionRule;
   measure: CompetitionMeasure;
   scope: CompetitionScope;
   checks: CompetitionChecks;
   areaType: CompetitionArea;
   areaName?: string | null;
   areaLatitude?: number | null;
   areaLongitude?: number | null;
   areaRadiusKm?: number | null;
   inviteeIds?: string[];
   /* The fish it is for. Empty is any species. */
   speciesIds?: string[];
   startsAt: string;
   endsAt: string;
   maxPerSpeciesPerDay?: number;
   /* Teams: how many, their names in order, and how many a side may hold. */
   teamsEnabled?: boolean;
   teamCount?: number | null;
   teamNames?: string[];
   maxPerTeam?: number | null;
};

export async function createCompetition(input: NewCompetition) {
   const { data } = await axios.post<{ competition: Competition }>(
      '/api/competitions',
      {
         ...input,
         /* The older single field rides along when there is exactly one fish,
            which is all a server a version behind knows how to keep. The
            current one folds the two into one list. */
         speciesId: input.speciesIds?.length === 1 ? input.speciesIds[0] : null,
      }
   );
   return readCompetition(data.competition);
}

/* Joining, and with teams, joining a side. The same call changes side before
   the start. */
export const enterCompetition = (id: string, teamId?: string | null) =>
   axios.post(`/api/competitions/${id}/join`, teamId ? { teamId } : {});

/* The organiser's hand on the teams. */
export const addTeam = (id: string, name: string) =>
   axios.post<{ id: string; name: string; position: number }>(
      `/api/competitions/${id}/teams`,
      { name }
   );
export const renameTeam = (id: string, teamId: string, name: string) =>
   axios.patch(`/api/competitions/${id}/teams/${teamId}`, { name });
export const removeTeam = (id: string, teamId: string) =>
   axios.delete(`/api/competitions/${id}/teams/${teamId}`);
export const assignTeam = (id: string, userId: string, teamId: string) =>
   axios.post(`/api/competitions/${id}/teams/assign`, { userId, teamId });

/* A team rule the server turned down, in its own words. */
export const teamRefusal = (error: unknown) => {
   const data = (error as { response?: { data?: { message?: unknown } } })
      ?.response?.data;
   return typeof data?.message === 'string'
      ? data.message
      : 'That did not go through. Try again.';
};

export const leaveCompetition = (id: string) =>
   axios.delete(`/api/competitions/${id}/join`);

/* ---- entries ---------------------------------------------------------- */

export type NewEntry = {
   catchId: string;
   /* Which of the catch's photographs is the fish, by name: the entry keeps
      each photograph as what it is, not as the first of a list. */
   fishImage: { storageKey: string } | null;
   /* The fish on the tape or scale; null for a most-species competition. */
   measureImage: { storageKey: string; url: string } | null;
   /* What the camera wrote in the measure photograph. */
   measureTakenAt?: string | null;
   /* What the angler typed, metric: cm or kg. Null when nothing is judged. */
   declaredValue: number | null;
   areaConfirmed: boolean;
   /* What the camera wrote in the hero photo, when it wrote anything. */
   photoTakenAt: string | null;
   note?: string | null;
};

export async function submitEntry(competitionId: string, input: NewEntry) {
   const { data } = await axios.post<{ entry: CompetitionEntry }>(
      `/api/competitions/${competitionId}/entries`,
      input
   );
   return data.entry;
}

export async function fetchEntry(
   competitionId: string,
   entryId: string,
   signal?: AbortSignal
) {
   const { data } = await axios.get<{ entry: CompetitionEntry }>(
      `/api/competitions/${competitionId}/entries/${entryId}`,
      { signal }
   );
   return data.entry;
}

export const withdrawEntry = (competitionId: string, entryId: string) =>
   axios.delete(`/api/competitions/${competitionId}/entries/${entryId}`);

export async function reviewEntry(
   competitionId: string,
   entryId: string,
   action: 'accept' | 'exclude',
   note?: string | null
) {
   const { data } = await axios.post<{ entry: CompetitionEntry }>(
      `/api/competitions/${competitionId}/entries/${entryId}/review`,
      { action, note: note?.trim() || null }
   );
   return data.entry;
}

export async function flagEntry(
   competitionId: string,
   entryId: string,
   reason: string
) {
   const { data } = await axios.post<{ entry: CompetitionEntry }>(
      `/api/competitions/${competitionId}/entries/${entryId}/flag`,
      { reason: reason.trim() }
   );
   return data.entry;
}

/* ---- words ------------------------------------------------------------ */

/** "25 Sep to 27 Sep", or one day when it is one day. */
export function dateRange(startsAt: string, endsAt: string) {
   const from = formatDayMonth(startsAt);
   const to = formatDayMonth(endsAt);
   if (!from || !to) return '';
   return from === to ? from : `${from} to ${to}`;
}

/**
 * The same range, shortened where the month repeats: "18 to 21 Sep" rather
 * than "18 Sep to 21 Sep". The card has one line for where and when, so the
 * month is written once when once is enough.
 */
export function dateSpan(startsAt: string, endsAt: string) {
   const from = toDate(startsAt);
   const to = toDate(endsAt);
   if (!from || !to) return '';
   const long = dateRange(startsAt, endsAt);
   if (
      from.getFullYear() === to.getFullYear() &&
      from.getMonth() === to.getMonth()
   ) {
      return from.getDate() === to.getDate()
         ? (formatDayMonth(from) ?? '')
         : `${from.getDate()} to ${formatDayMonth(to)}`;
   }
   return long;
}

/** "Fri 18 Sep, 06:00 to Mon 21 Sep, 18:00", the whole window in full. */
export function whenSentence(startsAt: string, endsAt: string) {
   const from = toDate(startsAt);
   const to = toDate(endsAt);
   if (!from || !to) return '';
   return `${formatDay(from)}, ${formatClock(from)} to ${formatDay(to)}, ${formatClock(to)}`;
}

/*
 * The clock on a card: what a wall clock would say about this competition
 * whatever state it is in. Running counts down, an upcoming one says when it
 * opens, a finished one says when it closed.
 */
export function clockWords(
   c: Pick<Competition, 'status' | 'startsAt' | 'endsAt'>,
   now = Date.now()
) {
   if (c.status === 'upcoming') return `Starts ${formatDayMonth(c.startsAt)}`;
   if (c.status === 'finished') return `Ended ${formatDayMonth(c.endsAt)}`;
   const ms = new Date(c.endsAt).getTime() - now;
   if (ms <= 0) return 'Closed';
   const minutes = Math.floor(ms / 60000);
   const hours = Math.floor(minutes / 60);
   const days = Math.floor(hours / 24);
   if (days >= 2) return `${days} days left`;
   if (hours >= 1) return `${hours} h left`;
   return `${minutes} min left`;
}

/*
 * The big clock on a competition's plate, split so the figure can be League
 * Gothic and the word beside it a tracked label: ["45 h 37 min", "left"].
 * Null once there is nothing left to count.
 */
export function clockParts(
   c: Pick<Competition, 'status' | 'startsAt' | 'endsAt'>,
   now = Date.now()
): [string, string] | null {
   if (c.status === 'finished') return null;
   const at = c.status === 'upcoming' ? c.startsAt : c.endsAt;
   const word = c.status === 'upcoming' ? 'until it opens' : 'left';
   const ms = new Date(at).getTime() - now;
   if (ms <= 0) return null;
   const minutes = Math.floor(ms / 60000);
   const hours = Math.floor(minutes / 60);
   const days = Math.floor(hours / 24);
   if (days >= 2) return [`${days} days ${hours % 24} h`, word];
   if (hours >= 1) return [`${hours} h ${minutes % 60} min`, word];
   return [`${minutes} min`, word];
}

/**
 * Where it counts, on a card: the water and how far from it, no preposition.
 * "Vaal Dam, 25 km".
 */
export const whereWords = (
   c: Pick<Competition, 'areaType' | 'areaName' | 'areaRadiusKm'>
) => {
   if (c.areaType === 'ANYWHERE' || !c.areaName)
      return 'Anywhere in South Africa';
   if (c.areaType === 'WATERBODY' && c.areaRadiusKm)
      return `${c.areaName}, ${c.areaRadiusKm} km`;
   return c.areaName;
};

/**
 * The same thing written out for the rules table, where there is room for
 * the whole sentence: "Vaal Dam, within 25 km of Oranjeville".
 */
export const whereSentence = (
   c: Pick<Competition, 'areaType' | 'areaName' | 'areaRadiusKm'>
) => {
   if (c.areaType === 'ANYWHERE' || !c.areaName)
      return 'Anywhere in South Africa';
   if (c.areaType === 'WATERBODY' && c.areaRadiusKm)
      return `Within ${c.areaRadiusKm} km of ${c.areaName}`;
   return c.areaName;
};

/** "Carp", "Carp or Barbel", "Carp, Barbel or Tilapia". */
export const listWords = (names: string[], joiner = 'or') =>
   names.length <= 1
      ? (names[0] ?? '')
      : `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`;

/*
 * The fish a competition is for, as the tail of a sentence: "carp only",
 * "carp or barbel only", and past three the first two and a count, because a
 * card has one line for the rule and twelve names are not a line. The "only"
 * is what keeps a list of fish after a comma from reading as more of the
 * rule. Empty when it is for any species, so a caller can leave the comma out
 * too.
 */
export const speciesWords = (
   species: Pick<CompetitionSpecies, 'commonName'>[] | null | undefined,
   short = true
) => {
   const names = (species ?? []).map((s) => s.commonName.toLowerCase());
   if (!names.length) return '';
   if (short && names.length > 3)
      return `${names[0]}, ${names[1]} and ${names.length - 2} more species`;
   return `${listWords(names)} only`;
};

/** The rule with its species folded in, the way a card prints it. */
export const ruleWords = (
   c: Pick<Competition, 'rule' | 'measure' | 'species'>
) => {
   const fish = speciesWords(c.species);
   return fish
      ? `${ruleSentence(c.rule, c.measure)}, ${fish}`
      : ruleSentence(c.rule, c.measure);
};

/** "6 anglers", "1 angler". */
export const anglerWords = (count: number) =>
   count === 1 ? '1 angler' : `${count} anglers`;

/** The figure a competition is led by, in the reader's units. */
export function leadingFigure(
   competition: Competition,
   value: number | null | undefined,
   units: UnitChoice
) {
   if (value === null || value === undefined) return null;
   if (competition.rule === 'SPECIES_VARIETY') {
      return `${value} ${value === 1 ? 'species' : 'species'}`;
   }
   return formatMeasure(value, competition.measure, units);
}

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
   return `Total ${unit}`;
};

/** How it is judged, as the form and the banner say it. */
export const judgedSentence = (
   rule: CompetitionRule,
   measure: CompetitionMeasure
) =>
   rule === 'SPECIES_VARIETY'
      ? 'most different species'
      : measure === 'LENGTH'
        ? 'length from a tape'
        : 'weight from a scale';

/** Where it counts, in words. */
export const areaSentence = (c: Pick<Competition, 'areaType' | 'areaName'>) =>
   c.areaType === 'ANYWHERE' || !c.areaName
      ? 'Anywhere in South Africa'
      : c.areaName;

/** What happens to an entry, in words. */
export const checksSentence = (checks: CompetitionChecks) =>
   checks === 'REVIEW'
      ? 'Entries count after the organiser accepts them.'
      : 'Entries count as soon as the checks pass.';

export const statusLabel = (status: CompetitionStatus) =>
   status === 'running'
      ? 'Running'
      : status === 'upcoming'
        ? 'Upcoming'
        : 'Results';

export const scopeLabel = (scope: CompetitionScope) =>
   scope === 'PUBLIC' ? 'Open to all' : 'Invite only';

export const entryStateLabel = (state: EntryState) =>
   state === 'COUNTED'
      ? 'Counted'
      : state === 'HELD'
        ? 'Awaiting review'
        : state === 'EXCLUDED'
          ? 'Not counted'
          : 'Checking';

/** A most-species competition needs no tape or scale photograph. */
export const needsMeasurePhoto = (c: Pick<Competition, 'rule'>) =>
   c.rule !== 'SPECIES_VARIETY';

/** The nine, for a competition scoped to one. */
export const PROVINCES = [
   'Eastern Cape',
   'Free State',
   'Gauteng',
   'KwaZulu-Natal',
   'Limpopo',
   'Mpumalanga',
   'North West',
   'Northern Cape',
   'Western Cape',
] as const;

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
   return data.invites.map((invite) => ({
      ...invite,
      competition: readCompetition(invite.competition),
   }));
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
