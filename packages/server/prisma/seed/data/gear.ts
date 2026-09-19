export type SeedGear = {
   id: string;
   ownerId: string;
   name: string;
   brand: string;
   type: string;
   notes: string;
};

/* What an actual shore angler carries, rather than a catalogue. */
export const GEAR: SeedGear[] = [
   {
      id: 'seed_gear_1',
      ownerId: 'seed_angler_thabo',
      name: '14ft surf rod',
      brand: 'Assassin',
      type: 'ROD',
      notes: 'Workhorse. Handles a 6oz grapnel in a side wind.',
   },
   {
      id: 'seed_gear_2',
      ownerId: 'seed_angler_thabo',
      name: 'Slow pitch reel',
      brand: 'Daiwa',
      type: 'REEL',
      notes: 'Serviced after every second trip, salt gets everywhere.',
   },
   {
      id: 'seed_gear_3',
      ownerId: 'seed_angler_nadia',
      name: '12ft light surf',
      brand: 'Kingfisher',
      type: 'ROD',
      notes: 'For the lagoon and the calmer False Bay days.',
   },
   {
      id: 'seed_gear_4',
      ownerId: 'seed_angler_nadia',
      name: '0.40mm mono',
      brand: 'Maxima',
      type: 'LINE',
      notes: 'Forgiving over reef.',
   },
   {
      id: 'seed_gear_5',
      ownerId: 'seed_angler_sipho',
      name: 'Estuary spinning rod',
      brand: 'Shimano',
      type: 'ROD',
      notes: 'Light enough to cast all morning.',
   },
   {
      id: 'seed_gear_6',
      ownerId: 'seed_angler_karen',
      name: 'Galjoen rod',
      brand: 'Poseidon',
      type: 'ROD',
      notes: 'Short and stiff for the gullies.',
   },
   {
      id: 'seed_gear_7',
      ownerId: 'seed_angler_karen',
      name: '4/0 circle hooks',
      brand: 'Mustad',
      type: 'HOOK',
      notes: 'Circles only. Fewer gut hooks, more fish go back well.',
   },
   {
      id: 'seed_gear_8',
      ownerId: 'seed_angler_riaan',
      name: 'West coast heavy',
      brand: 'Assassin',
      type: 'ROD',
      notes: 'Built for wind rather than comfort.',
   },
   {
      id: 'seed_gear_9',
      ownerId: 'seed_angler_lerato',
      name: '6oz grapnel leads',
      brand: 'Local',
      type: 'WEIGHTS',
      notes: 'Bought by the dozen, lost by the dozen.',
   },
   {
      id: 'seed_gear_10',
      ownerId: 'seed_angler_deon',
      name: 'Old glass rod',
      brand: 'Unbranded',
      type: 'ROD',
      notes: 'Older than most of the people on the beach. Still fine.',
   },
   {
      id: 'seed_gear_11',
      ownerId: 'seed_angler_amara',
      name: 'Starter surf combo',
      brand: 'Kingfisher',
      type: 'ROD',
      notes: 'First rod. Learning what it will and will not do.',
   },
   {
      id: 'seed_gear_12',
      ownerId: 'seed_angler_sipho',
      name: 'Soft plastics',
      brand: 'Various',
      type: 'LURE',
      notes: 'For grunter on the flats when bait is a nuisance.',
   },
];
