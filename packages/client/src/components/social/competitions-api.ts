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
   scope: 'PUBLIC' | 'GROUP';
   startsAt: string;
   endsAt: string;
   maxPerSpeciesPerDay: number;
   speciesId: string | null;
   species: { id: string; commonName: string } | null;
   createdBy: { id: string; displayName: string; username: string | null };
   entrantCount: number;
   youEntered: boolean;
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

export async function fetchCompetitions(signal?: AbortSignal) {
   const { data } = await axios.get<{ competitions: Competition[] }>(
      '/api/competitions',
      { signal }
   );
   return data.competitions ?? [];
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
   scope: 'PUBLIC' | 'GROUP';
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
