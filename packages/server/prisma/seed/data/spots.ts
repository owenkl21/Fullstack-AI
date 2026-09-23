/*
 * Fifteen Western Cape shore spots. Coordinates are approximate and deliberately
 * so: these are well-known public marks, not anyone's private mark, and a seed
 * file is the wrong place for a precise pin.
 */
export type SeedSpot = {
   id: string;
   name: string;
   latitude: number;
   longitude: number;
   waterType: 'SALTWATER' | 'FRESHWATER' | 'BRACKISH' | 'OTHER';
   description: string;
   accessNotes: string;
   ownerId: string;
};

export const SPOTS: SeedSpot[] = [
   {
      id: 'seed_spot_kommetjie',
      name: 'Kommetjie',
      latitude: -34.1406,
      longitude: 18.3275,
      waterType: 'SALTWATER',
      description:
         'Long stretch of reef and sand on the Atlantic side. Works best on a pushing tide with some swell running.',
      accessNotes:
         'Park at the lighthouse and walk south. Rocks are slick at low water.',
      ownerId: 'seed_angler_thabo',
   },
   {
      id: 'seed_spot_scarborough',
      name: 'Scarborough',
      latitude: -34.2043,
      longitude: 18.3742,
      waterType: 'SALTWATER',
      description:
         'Open beach with gullies at the northern end. Exposed to the south easter.',
      accessNotes: 'Public parking above the beach. Long carry to the gullies.',
      ownerId: 'seed_angler_karen',
   },
   {
      id: 'seed_spot_olifantsbos',
      name: 'Olifantsbos',
      latitude: -34.2611,
      longitude: 18.3797,
      waterType: 'SALTWATER',
      description:
         'Inside the reserve. Rough ground, good structure, very few people.',
      accessNotes:
         'Reserve gate hours apply. Check them before planning a dawn start.',
      ownerId: 'seed_angler_deon',
   },
   {
      id: 'seed_spot_millers',
      name: 'Millers Point',
      latitude: -34.2297,
      longitude: 18.4747,
      waterType: 'SALTWATER',
      description: 'False Bay side, deep water close in off the ledges.',
      accessNotes: 'Steep path down from the parking area.',
      ownerId: 'seed_angler_nadia',
   },
   {
      id: 'seed_spot_glencairn',
      name: 'Glencairn Beach',
      latitude: -34.1631,
      longitude: 18.4303,
      waterType: 'SALTWATER',
      description: 'Sheltered beach in False Bay. Forgiving in a south easter.',
      accessNotes:
         'Parking along the main road, short walk over the rail line.',
      ownerId: 'seed_angler_amara',
   },
   {
      id: 'seed_spot_strandfontein',
      name: 'Strandfontein',
      latitude: -34.0872,
      longitude: 18.5597,
      waterType: 'SALTWATER',
      description:
         'Long sand beach along the False Bay shore. Kob water after dark.',
      accessNotes:
         'Several public access points. Do not fish it alone at night.',
      ownerId: 'seed_angler_nadia',
   },
   {
      id: 'seed_spot_macassar',
      name: 'Macassar',
      latitude: -34.0797,
      longitude: 18.7511,
      waterType: 'SALTWATER',
      description:
         'Eastern end of False Bay. Shallow gradient, wide gutters on a low tide.',
      accessNotes: 'Beach parking. Soft sand, four wheel drive is easier.',
      ownerId: 'seed_angler_sipho',
   },
   {
      id: 'seed_spot_gordons',
      name: "Gordon's Bay",
      latitude: -34.1594,
      longitude: 18.8686,
      waterType: 'SALTWATER',
      description: 'Harbour wall and the rocks past it. Good in a westerly.',
      accessNotes: 'Harbour parking, watch the signage on the wall itself.',
      ownerId: 'seed_angler_lerato',
   },
   {
      id: 'seed_spot_rooiels',
      name: 'Rooi Els',
      latitude: -34.2978,
      longitude: 18.8158,
      waterType: 'SALTWATER',
      description: 'Boulder ground under the mountain. Heavy tackle country.',
      accessNotes: 'Roadside parking, then a scramble. Not a spot to rush.',
      ownerId: 'seed_angler_deon',
   },
   {
      id: 'seed_spot_pringle',
      name: 'Pringle Bay',
      latitude: -34.3506,
      longitude: 18.8264,
      waterType: 'SALTWATER',
      description: 'Mixed sand and reef, quieter than the Rooi Els side.',
      accessNotes: 'Village parking and a short walk down.',
      ownerId: 'seed_angler_karen',
   },
   {
      id: 'seed_spot_hermanus',
      name: 'Hermanus Cliffs',
      latitude: -34.4187,
      longitude: 19.2345,
      waterType: 'SALTWATER',
      description:
         'Cliff ledges along the town side. Deep water, careful footing.',
      accessNotes:
         'Cliff path access. Do not fish the lower ledges in big swell.',
      ownerId: 'seed_angler_riaan',
   },
   {
      id: 'seed_spot_yzerfontein',
      name: 'Yzerfontein',
      latitude: -33.3475,
      longitude: 18.1531,
      waterType: 'SALTWATER',
      description: 'West coast beach and reef. Cold, clean water.',
      accessNotes: 'Public beach parking at the main access.',
      ownerId: 'seed_angler_riaan',
   },
   {
      id: 'seed_spot_langebaan',
      name: 'Langebaan Lagoon',
      latitude: -33.0917,
      longitude: 18.0303,
      waterType: 'BRACKISH',
      description:
         'Sheltered lagoon. Light tackle, grunter and stumpnose on the flats.',
      accessNotes: 'Park regulations apply on the southern shore.',
      ownerId: 'seed_angler_sipho',
   },
   {
      id: 'seed_spot_bergriver',
      name: 'Berg River Mouth',
      latitude: -32.7761,
      longitude: 18.1461,
      waterType: 'BRACKISH',
      description:
         'River mouth on the west coast. Runs dirty after rain, which can be the point.',
      accessNotes: 'Access from the Velddrif side.',
      ownerId: 'seed_angler_lerato',
   },
   {
      id: 'seed_spot_clanwilliam',
      name: 'Clanwilliam Dam',
      latitude: -32.1897,
      longitude: 18.8917,
      waterType: 'FRESHWATER',
      description: 'Freshwater, and the only one here. Yellowfish and bass.',
      accessNotes: 'Public launch site, day permits at the office.',
      ownerId: 'seed_angler_amara',
   },
];
