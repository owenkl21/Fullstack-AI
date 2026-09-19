/*
 * Eight anglers. Names and handles are invented; the photographs that stand in
 * for them are not of these people and are not claimed to be.
 *
 * Ids are fixed rather than generated, so a second run updates the same rows
 * instead of making eight more.
 */
export type SeedAngler = {
   id: string;
   email: string;
   username: string;
   displayName: string;
   bio: string;
};

export const ANGLERS: SeedAngler[] = [
   {
      id: 'seed_angler_thabo',
      email: 'thabo@example.invalid',
      username: 'thabo_m',
      displayName: 'Thabo Mokoena',
      bio: 'Rock and surf, mostly the Cape Peninsula. Out before first light.',
   },
   {
      id: 'seed_angler_nadia',
      email: 'nadia@example.invalid',
      username: 'nadia_v',
      displayName: 'Nadia van Wyk',
      bio: 'Kob on the incoming tide. Everything goes back.',
   },
   {
      id: 'seed_angler_sipho',
      email: 'sipho@example.invalid',
      username: 'sipho_d',
      displayName: 'Sipho Dlamini',
      bio: 'Estuary and lagoon. Light tackle, long walks.',
   },
   {
      id: 'seed_angler_karen',
      email: 'karen@example.invalid',
      username: 'karen_j',
      displayName: 'Karen Jacobs',
      bio: 'Galjoen season is the only season.',
   },
   {
      id: 'seed_angler_riaan',
      email: 'riaan@example.invalid',
      username: 'riaan_b',
      displayName: 'Riaan Botha',
      bio: 'West coast. Wind is a detail.',
   },
   {
      id: 'seed_angler_lerato',
      email: 'lerato@example.invalid',
      username: 'lerato_k',
      displayName: 'Lerato Khumalo',
      bio: 'Weekends on the rocks, weekdays reading the charts.',
   },
   {
      id: 'seed_angler_deon',
      email: 'deon@example.invalid',
      username: 'deon_p',
      displayName: 'Deon Pieterse',
      bio: 'Forty years on the same three spots.',
   },
   {
      id: 'seed_angler_amara',
      email: 'amara@example.invalid',
      username: 'amara_n',
      displayName: 'Amara Ndlovu',
      bio: 'Started last winter. Keeping a proper record of it.',
   },
];
