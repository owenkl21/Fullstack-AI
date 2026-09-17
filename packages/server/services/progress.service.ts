import { prisma } from '../lib/prisma';

/*
 * How far an angler has come.
 *
 * A rank that rises with the log: not with how many fish, only, but with how
 * much of the coast has been fished, how many kinds of fish, how many
 * mornings, how carefully each one was recorded, and how many went back. The
 * points are counted from the catches every time rather than stored, so a
 * deleted catch takes its points with it and nothing can drift.
 *
 * The names are the words shore anglers use for each other, from the person
 * who has never held a rod to the one everyone on the ledge knows by name.
 */

export type Rank = { index: number; name: string; minPoints: number };

export const RANKS: Rank[] = [
   { index: 0, name: 'Greenhorn', minPoints: 0 },
   { index: 1, name: 'Bait runner', minPoints: 150 },
   { index: 2, name: 'Rock hopper', minPoints: 400 },
   { index: 3, name: 'Gully reader', minPoints: 900 },
   { index: 4, name: 'Surf caster', minPoints: 1800 },
   { index: 5, name: 'Ledge regular', minPoints: 3500 },
   { index: 6, name: 'Coast runner', minPoints: 6500 },
   { index: 7, name: 'Salt veteran', minPoints: 12000 },
   { index: 8, name: 'Grand angler', minPoints: 22000 },
   { index: 9, name: 'Legend of the ledges', minPoints: 40000 },
];

/*
 * What each thing is worth. Written out here rather than buried in the
 * arithmetic, because these are the rules of the game and an angler is
 * entitled to read them.
 */
export const WORTH = {
   fish: 10,
   measured: 5,
   photographed: 5,
   conditions: 2,
   species: 40,
   spot: 30,
   /* One point a kilometre of range, to a thousand. */
   rangeKmCap: 1000,
   day: 15,
   released: 5,
   bigFish: 25,
   greatFish: 60,
   competition: 50,
} as const;

export type Breakdown = {
   key: string;
   label: string;
   points: number;
   /* The count the points came from, in words. */
   detail: string;
};

export type Badge = {
   key: string;
   name: string;
   /* What earns it, in one line. */
   how: string;
   earned: boolean;
   /* How far along, 0 to 1, for the ones not yet earned. */
   progress: number;
};

export type Progress = {
   points: number;
   rank: Rank;
   next: Rank | null;
   /* From this rank to the next, 0 to 1. */
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

const EARTH_KM = 6371;

const haversineKm = (
   a: { lat: number; lng: number },
   b: { lat: number; lng: number }
) => {
   const rad = (d: number) => (d * Math.PI) / 180;
   const dLat = rad(b.lat - a.lat);
   const dLng = rad(b.lng - a.lng);
   const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
   return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
};

/* The catch's local hour, for dawn and night. The coast is UTC+2 all year. */
const localHour = (when: Date) =>
   Number(
      new Intl.DateTimeFormat('en-GB', {
         hour: 'numeric',
         hour12: false,
         timeZone: 'Africa/Johannesburg',
      }).format(when)
   );

const isoWeek = (when: Date) => {
   const d = new Date(
      Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate())
   );
   const day = d.getUTCDay() || 7;
   d.setUTCDate(d.getUTCDate() + 4 - day);
   const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
   const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
   return d.getUTCFullYear() * 100 + week;
};

const plural = (n: number, one: string, many = `${one}s`) =>
   `${n} ${n === 1 ? one : many}`;

export const progressService = {
   /**
    * The progress of one angler. Their own page counts every catch; anyone
    * else's view counts only what they made public, so a private log does
    * not show through the rank.
    */
   async forUser(userId: string, viewerId: string | null): Promise<Progress> {
      const own = viewerId === userId;
      const rows = await prisma.catch.findMany({
         where: {
            createdById: userId,
            deletedAt: null,
            ...(own ? {} : { visibility: 'PUBLIC' }),
         },
         select: {
            caughtAt: true,
            count: true,
            length: true,
            weight: true,
            released: true,
            speciesId: true,
            siteId: true,
            latitude: true,
            longitude: true,
            weatherCurrentTime: true,
            weatherMoonSpringTide: true,
            weatherConditionText: true,
            site: { select: { latitude: true, longitude: true } },
            _count: { select: { images: true } },
         },
      });

      const entered = await prisma.competitionEntrant.count({
         where: { userId },
      });

      const fish = rows.reduce((n, r) => n + Math.max(1, r.count), 0);
      const measured = rows.filter(
         (r) => r.length !== null || r.weight !== null
      ).length;
      const photographed = rows.filter((r) => r._count.images > 0).length;
      const withConditions = rows.filter((r) => r.weatherCurrentTime).length;
      const species = new Set(
         rows.map((r) => r.speciesId).filter((id): id is string => !!id)
      );
      const spots = new Set(
         rows.map((r) => r.siteId).filter((id): id is string => !!id)
      );
      const days = new Set(
         rows.map((r) => r.caughtAt.toISOString().slice(0, 10))
      );
      const released = rows
         .filter((r) => r.released)
         .reduce((n, r) => n + Math.max(1, r.count), 0);
      const big = rows.filter(
         (r) => r.length !== null && r.length >= 60 && r.length < 90
      ).length;
      const great = rows.filter(
         (r) => r.length !== null && r.length >= 90
      ).length;
      const biggestCm = rows.reduce<number | null>(
         (best, r) =>
            r.length !== null && (best === null || r.length > best)
               ? r.length
               : best,
         null
      );

      /*
       * Range: the two furthest-apart places fished. Every catch with a
       * position, its own pin or its spot's, and the greatest distance
       * between any two of them.
       */
      const places = new Map<string, { lat: number; lng: number }>();
      for (const r of rows) {
         const lat = r.latitude ?? r.site?.latitude ?? null;
         const lng = r.longitude ?? r.site?.longitude ?? null;
         if (lat === null || lng === null) continue;
         places.set(`${lat.toFixed(3)},${lng.toFixed(3)}`, { lat, lng });
      }
      const points = [...places.values()];
      let rangeKm = 0;
      for (let i = 0; i < points.length; i++) {
         for (let j = i + 1; j < points.length; j++) {
            rangeKm = Math.max(rangeKm, haversineKm(points[i]!, points[j]!));
         }
      }
      rangeKm = Math.round(rangeKm);

      const breakdown: Breakdown[] = [
         {
            key: 'fish',
            label: 'Fish logged',
            points: fish * WORTH.fish,
            detail: plural(fish, 'fish', 'fish'),
         },
         {
            key: 'species',
            label: 'Species',
            points: species.size * WORTH.species,
            detail: plural(species.size, 'kind of fish', 'kinds of fish'),
         },
         {
            key: 'spots',
            label: 'Spots fished',
            points: spots.size * WORTH.spot,
            detail: plural(spots.size, 'spot'),
         },
         {
            key: 'range',
            label: 'Range',
            points: Math.min(rangeKm, WORTH.rangeKmCap),
            detail: `${rangeKm} km between your furthest spots`,
         },
         {
            key: 'days',
            label: 'Days on the water',
            points: days.size * WORTH.day,
            detail: plural(days.size, 'day'),
         },
         {
            key: 'measured',
            label: 'Measured',
            points: measured * WORTH.measured,
            detail: plural(measured, 'catch measured', 'catches measured'),
         },
         {
            key: 'photographed',
            label: 'Photographed',
            points: photographed * WORTH.photographed,
            detail: plural(
               photographed,
               'catch with a photo',
               'catches with photos'
            ),
         },
         {
            key: 'conditions',
            label: 'Conditions on record',
            points: withConditions * WORTH.conditions,
            detail: plural(withConditions, 'catch', 'catches'),
         },
         {
            key: 'released',
            label: 'Released',
            points: released * WORTH.released,
            detail: plural(released, 'fish put back', 'fish put back'),
         },
         {
            key: 'big',
            label: 'Big fish',
            points: big * WORTH.bigFish + great * WORTH.greatFish,
            detail: `${plural(big, 'fish', 'fish')} over 60 cm, ${great} over 90`,
         },
         {
            key: 'competitions',
            label: 'Competitions',
            points: entered * WORTH.competition,
            detail: plural(entered, 'entered', 'entered'),
         },
      ];

      const total = breakdown.reduce((n, b) => n + b.points, 0);
      const rank =
         [...RANKS].reverse().find((r) => total >= r.minPoints) ?? RANKS[0]!;
      const next = RANKS[rank.index + 1] ?? null;
      const progress = next
         ? (total - rank.minPoints) / (next.minPoints - rank.minPoints)
         : 1;

      /* Badges: each one a thing that happened, not a threshold on the score. */
      const dawn = rows.filter((r) => localHour(r.caughtAt) < 6).length;
      const night = rows.filter((r) => localHour(r.caughtAt) >= 22).length;
      const spring = rows.filter((r) => r.weatherMoonSpringTide).length;
      const storm = rows.filter((r) =>
         /rain|storm|shower|thunder/i.test(r.weatherConditionText ?? '')
      ).length;
      const bigSpecies = new Set(
         rows
            .filter((r) => r.length !== null && r.length >= 50 && r.speciesId)
            .map((r) => r.speciesId as string)
      ).size;
      const weeks = [...new Set(rows.map((r) => isoWeek(r.caughtAt)))].sort();
      let run = 0;
      let bestRun = 0;
      for (let i = 0; i < weeks.length; i++) {
         run = i > 0 && weeks[i]! - weeks[i - 1]! === 1 ? run + 1 : 1;
         bestRun = Math.max(bestRun, run);
      }

      const badge = (
         key: string,
         name: string,
         how: string,
         have: number,
         need: number
      ): Badge => ({
         key,
         name,
         how,
         earned: have >= need,
         progress: Math.min(1, need ? have / need : 0),
      });

      const badges: Badge[] = [
         badge('first-fish', 'First fish', 'Log a fish.', fish, 1),
         badge(
            'ten-species',
            'Ten kinds',
            'Ten species on the log.',
            species.size,
            10
         ),
         badge(
            'explorer',
            'Explorer',
            'Fish ten different spots.',
            spots.size,
            10
         ),
         badge('nomad', 'Nomad', 'Spots 300 km apart.', rangeKm, 300),
         badge(
            'dawn-patrol',
            'Dawn patrol',
            'A fish before six in the morning.',
            dawn,
            1
         ),
         badge(
            'night-owl',
            'Night owl',
            'A fish after ten at night.',
            night,
            1
         ),
         badge(
            'spring-tide',
            'Spring tide',
            'A fish on a spring tide.',
            spring,
            1
         ),
         badge('storm-chaser', 'Storm chaser', 'A fish in the rain.', storm, 1),
         badge(
            'conservationist',
            'Conservationist',
            'Put 25 fish back.',
            released,
            25
         ),
         badge(
            'photographer',
            'Photographer',
            'Twenty five catches with a photo.',
            photographed,
            25
         ),
         badge(
            'big-five',
            'Big five',
            'Five species over 50 cm.',
            bigSpecies,
            5
         ),
         badge('century', 'Century', 'A hundred fish.', fish, 100),
         badge(
            'seasoned',
            'Seasoned',
            'Fifty days on the water.',
            days.size,
            50
         ),
         badge(
            'regular',
            'Regular',
            'Four weeks in a row with a fish.',
            bestRun,
            4
         ),
      ];

      return {
         points: total,
         rank,
         next,
         progress: Math.max(0, Math.min(1, progress)),
         breakdown,
         badges,
         figures: {
            catches: rows.length,
            fish,
            species: species.size,
            spots: spots.size,
            rangeKm,
            days: days.size,
            released,
            photographed,
            biggestCm,
         },
      };
   },
};
