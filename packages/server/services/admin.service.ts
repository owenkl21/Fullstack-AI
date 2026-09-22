import { prisma } from '../lib/prisma';
import { recentMail } from '../lib/mailer';
import { mailStatus } from '../lib/mailer';

/*
 * Everything about the app, in six readings.
 *
 * The panel behind these is the one page that answers "how is Fisherfeed
 * doing" without anybody opening a database client, so the rule here is that
 * nothing is counted in JavaScript. Every figure is a COUNT, a SUM or a GROUP
 * BY that the database does, and every read is bounded: a leaderboard takes
 * the top so many, a curve takes a fixed number of days, and there is no
 * "read every row and add them up" anywhere in this file. One angler with a
 * hundred thousand catches must not be able to make this page fall over.
 *
 * Prisma cannot group by a date part, so the curves and the year grid are raw
 * SQL. They are the only raw queries in the codebase and they are all in this
 * file, parameterised through the tagged template, never by string building.
 *
 * Who may call any of this is settled one layer up, in lib/admin.ts. Nothing
 * in here checks a role, so nothing in here may be reached from a route that
 * does not carry that guard.
 */

/*
 * A figure off a raw query, as a number JSON can carry.
 *
 * Three shapes arrive and none of them is a number. COUNT() comes back a
 * BigInt, which JSON.stringify refuses outright. SUM() comes back a DECIMAL,
 * and the driver hands a DECIMAL over as an object of its own rather than a
 * string. And a UNION of a COUNT and a SUM widens the WHOLE column to DECIMAL,
 * so the branch that only ever counts arrives as one of those objects too.
 *
 * That last one is worth knowing about: it cost this file a page of zeros,
 * because a typeof test for number, bigint and string reads an object as
 * nothing and quietly returns 0 rather than failing. So the test is not on the
 * shape any more. Everything that is not already a number is put through
 * String(), which BigInt, DECIMAL and a plain string all answer sensibly, and
 * anything that does not parse comes back null for the caller to decide about.
 */
const toNumber = (value: unknown): number | null => {
   if (value === null || value === undefined) return null;
   if (typeof value === 'number') return Number.isFinite(value) ? value : null;
   const parsed = Number(typeof value === 'bigint' ? value : String(value));
   return Number.isFinite(parsed) ? parsed : null;
};

/* A count: nothing there means none of them. */
const num = (value: unknown): number => toNumber(value) ?? 0;

/* A measurement: nothing there stays nothing rather than becoming a zero. A
   species nobody has weighed has no heaviest, which is not 0 kg. */
const maybe = (value: unknown): number | null => toNumber(value);

const daysAgo = (days: number) => {
   const date = new Date();
   date.setUTCDate(date.getUTCDate() - days);
   return date;
};

/* A day as the grids and curves key on it, in the server's own clock. */
const dayKey = (value: unknown): string => {
   if (value instanceof Date) return value.toISOString().slice(0, 10);
   return String(value ?? '').slice(0, 10);
};

/* ---- 1. The headline figures ------------------------------------------- */

export type Figure = {
   key: string;
   label: string;
   total: number;
   /* New in the last seven and the last thirty days. */
   d7: number;
   d30: number;
};

/*
 * Nine counts in one round trip.
 *
 * Each branch counts its own table and, in the same pass, how much of it
 * arrived inside each window. MySQL adds a boolean as 1 or 0, so SUM over the
 * comparison is the windowed count without a second scan of anything.
 *
 * "Species" is the odd one: the total is how many different fish the app has
 * ever had logged, so its window is how many were logged for the FIRST time
 * inside it. A species caught again this week is not news. First is taken on
 * createdAt, not caughtAt, because every other figure on this row counts what
 * arrived in the app: a fish caught in 2019 and typed up last night is a
 * species the app learnt last night.
 */
async function overview() {
   const d7 = daysAgo(7);
   const d30 = daysAgo(30);

   const rows = await prisma.$queryRaw<
      { metric: string; total: unknown; w7: unknown; w30: unknown }[]
   >`
      SELECT 'anglers' AS metric, COUNT(*) AS total,
             SUM(createdAt >= ${d7}) AS w7, SUM(createdAt >= ${d30}) AS w30
        FROM users WHERE deletedAt IS NULL
      UNION ALL
      SELECT 'catches', COUNT(*),
             SUM(createdAt >= ${d7}), SUM(createdAt >= ${d30})
        FROM \`Catch\` WHERE deletedAt IS NULL
      UNION ALL
      SELECT 'fish', COALESCE(SUM(count), 0),
             COALESCE(SUM(CASE WHEN createdAt >= ${d7} THEN count END), 0),
             COALESCE(SUM(CASE WHEN createdAt >= ${d30} THEN count END), 0)
        FROM \`Catch\` WHERE deletedAt IS NULL
      UNION ALL
      SELECT 'species', COUNT(*),
             SUM(firstAt >= ${d7}), SUM(firstAt >= ${d30})
        FROM (SELECT speciesId, MIN(createdAt) AS firstAt
                FROM \`Catch\`
               WHERE deletedAt IS NULL AND speciesId IS NOT NULL
               GROUP BY speciesId) AS s
      UNION ALL
      SELECT 'spots', COUNT(*),
             SUM(createdAt >= ${d7}), SUM(createdAt >= ${d30})
        FROM \`FishingSite\` WHERE deletedAt IS NULL
      UNION ALL
      SELECT 'marks', COUNT(*),
             SUM(createdAt >= ${d7}), SUM(createdAt >= ${d30})
        FROM waypoints WHERE deletedAt IS NULL
      UNION ALL
      SELECT 'competitions', COUNT(*),
             SUM(createdAt >= ${d7}), SUM(createdAt >= ${d30})
        FROM competitions WHERE deletedAt IS NULL
      UNION ALL
      SELECT 'photos', COUNT(*),
             SUM(createdAt >= ${d7}), SUM(createdAt >= ${d30})
        FROM \`Image\`
      UNION ALL
      SELECT 'comments', COUNT(*),
             SUM(createdAt >= ${d7}), SUM(createdAt >= ${d30})
        FROM \`FeedComment\` WHERE deletedAt IS NULL
   `;

   const LABELS: Record<string, string> = {
      anglers: 'Anglers',
      catches: 'Logs',
      fish: 'Fish',
      species: 'Species',
      spots: 'Spots',
      marks: 'Private marks',
      competitions: 'Competitions',
      photos: 'Photos',
      comments: 'Comments',
   };
   const ORDER = Object.keys(LABELS);

   const figures: Figure[] = rows.map((row) => ({
      key: row.metric,
      label: LABELS[row.metric] ?? row.metric,
      total: num(row.total),
      d7: num(row.w7),
      d30: num(row.w30),
   }));

   figures.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
   return { figures };
}

/* ---- 2. Growth ---------------------------------------------------------- */

export type DayCount = { day: string; count: number };

/*
 * One row per day, for a year, three times: who joined, what was logged, what
 * was photographed. Three hundred and sixty five rows is the whole read, and
 * the week curve is folded out of the same rows rather than asked for again.
 *
 * The three curves key on createdAt, because this is how fast the APP grew: a
 * fish caught in 2019 and typed up last night is growth last night. The year
 * grid below keys on caughtAt instead, because that one is about fishing.
 */
async function growth() {
   const since = daysAgo(365);

   const [signUps, catches, photos, caught] = await Promise.all([
      prisma.$queryRaw<{ day: unknown; n: unknown }[]>`
         SELECT DATE(createdAt) AS day, COUNT(*) AS n
           FROM users
          WHERE deletedAt IS NULL AND createdAt >= ${since}
          GROUP BY day ORDER BY day`,
      prisma.$queryRaw<{ day: unknown; n: unknown }[]>`
         SELECT DATE(createdAt) AS day, COUNT(*) AS n
           FROM \`Catch\`
          WHERE deletedAt IS NULL AND createdAt >= ${since}
          GROUP BY day ORDER BY day`,
      prisma.$queryRaw<{ day: unknown; n: unknown }[]>`
         SELECT DATE(createdAt) AS day, COUNT(*) AS n
           FROM \`Image\`
          WHERE createdAt >= ${since}
          GROUP BY day ORDER BY day`,
      prisma.$queryRaw<{ day: unknown; n: unknown }[]>`
         SELECT DATE(caughtAt) AS day, COUNT(*) AS n
           FROM \`Catch\`
          WHERE deletedAt IS NULL AND caughtAt >= ${since}
          GROUP BY day ORDER BY day`,
   ]);

   const asMap = (rows: { day: unknown; n: unknown }[]) => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(dayKey(row.day), num(row.n));
      return map;
   };

   const signUpsBy = asMap(signUps);
   const catchesBy = asMap(catches);
   const photosBy = asMap(photos);
   const caughtBy = asMap(caught);

   /* Every day in the window, including the empty ones: a curve with the
      quiet days missing is a curve that lies about the quiet days. */
   const days: string[] = [];
   const cursor = new Date();
   cursor.setUTCHours(0, 0, 0, 0);
   cursor.setUTCDate(cursor.getUTCDate() - 364);
   for (let i = 0; i < 365; i += 1) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
   }

   const series = (map: Map<string, number>): DayCount[] =>
      days.map((day) => ({ day, count: map.get(day) ?? 0 }));

   const daily = {
      signUps: series(signUpsBy),
      catches: series(catchesBy),
      photos: series(photosBy),
   };

   /* Weeks, folded off the same days: every seventh day starts a bucket, and
      the bucket is named by the day it opens. */
   const weekly = (rows: DayCount[]): DayCount[] => {
      const out: DayCount[] = [];
      for (let i = 0; i < rows.length; i += 7) {
         const slice = rows.slice(i, i + 7);
         out.push({
            day: slice[0]?.day ?? '',
            count: slice.reduce((sum, row) => sum + row.count, 0),
         });
      }
      return out;
   };

   return {
      daily,
      weekly: {
         signUps: weekly(daily.signUps),
         catches: weekly(daily.catches),
         photos: weekly(daily.photos),
      },
      /* The year of fishing, one square a day, for the heat grid. */
      caughtByDay: series(caughtBy),
   };
}

/* ---- 3. The fish -------------------------------------------------------- */

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

/*
 * The leaderboard, and who holds each record.
 *
 * Two reads. The first groups the log by species; the second finds, for every
 * species, the single longest and the single heaviest fish and the name on
 * them. That second one numbers the rows inside each species and keeps only
 * the first, so it is one pass rather than a query per species.
 */
async function fish() {
   const [board, holders, months, keep, lengths, weights] = await Promise.all([
      prisma.$queryRaw<
         {
            id: string;
            name: string;
            logs: unknown;
            fish: unknown;
            longest: unknown;
            heaviest: unknown;
         }[]
      >`
         SELECT s.id AS id, s.commonName AS name,
                COUNT(*) AS logs, COALESCE(SUM(c.count), 0) AS fish,
                MAX(c.length) AS longest, MAX(c.weight) AS heaviest
           FROM \`Catch\` c
           JOIN \`Species\` s ON s.id = c.speciesId
          WHERE c.deletedAt IS NULL
          GROUP BY s.id, s.commonName
          ORDER BY fish DESC, logs DESC
          LIMIT 200`,

      prisma.$queryRaw<
         { speciesId: string; kind: string; holder: string; value: unknown }[]
      >`
         SELECT speciesId, kind, holder, value FROM (
            SELECT c.speciesId AS speciesId, 'length' AS kind,
                   u.displayName AS holder, c.length AS value,
                   ROW_NUMBER() OVER (
                      PARTITION BY c.speciesId ORDER BY c.length DESC
                   ) AS rn
              FROM \`Catch\` c
              JOIN users u ON u.id = c.createdById
             WHERE c.deletedAt IS NULL AND c.speciesId IS NOT NULL
               AND c.length IS NOT NULL
            UNION ALL
            SELECT c.speciesId, 'weight', u.displayName, c.weight,
                   ROW_NUMBER() OVER (
                      PARTITION BY c.speciesId ORDER BY c.weight DESC
                   )
              FROM \`Catch\` c
              JOIN users u ON u.id = c.createdById
             WHERE c.deletedAt IS NULL AND c.speciesId IS NOT NULL
               AND c.weight IS NOT NULL
         ) AS ranked WHERE rn = 1`,

      /* Two years of months, so this season can be read against last. */
      prisma.$queryRaw<{ month: string; n: unknown }[]>`
         SELECT DATE_FORMAT(caughtAt, '%Y-%m') AS month, COUNT(*) AS n
           FROM \`Catch\`
          WHERE deletedAt IS NULL AND caughtAt >= ${daysAgo(730)}
          GROUP BY month ORDER BY month`,

      prisma.catch.groupBy({
         by: ['released'],
         where: { deletedAt: null },
         _count: { _all: true },
      }),

      /*
       * Ten centimetres a bucket. Everything at or over three metres lands in
       * the last one, which caps the answer at 31 rows however big the fish
       * in the log get, and keeps a single mis-typed 9000 from stretching the
       * chart flat.
       */
      prisma.$queryRaw<{ bucket: unknown; n: unknown }[]>`
         SELECT LEAST(FLOOR(length / 10) * 10, 300) AS bucket, COUNT(*) AS n
           FROM \`Catch\`
          WHERE deletedAt IS NULL AND length IS NOT NULL AND length > 0
          GROUP BY bucket ORDER BY bucket`,

      /* A kilogram a bucket, everything at or over twenty five in the last. */
      prisma.$queryRaw<{ bucket: unknown; n: unknown }[]>`
         SELECT LEAST(FLOOR(weight), 25) AS bucket, COUNT(*) AS n
           FROM \`Catch\`
          WHERE deletedAt IS NULL AND weight IS NOT NULL AND weight > 0
          GROUP BY bucket ORDER BY bucket`,
   ]);

   const holderOf = new Map<string, string>();
   const holderValue = new Map<string, number>();
   for (const row of holders) {
      holderOf.set(`${row.speciesId}:${row.kind}`, row.holder);
      holderValue.set(`${row.speciesId}:${row.kind}`, num(row.value));
   }

   const species: SpeciesRow[] = board.map((row) => ({
      id: row.id,
      name: row.name,
      logs: num(row.logs),
      fish: num(row.fish),
      longestCm: maybe(row.longest),
      longestBy: holderOf.get(`${row.id}:length`) ?? null,
      heaviestKg: maybe(row.heaviest),
      heaviestBy: holderOf.get(`${row.id}:weight`) ?? null,
   }));

   const released = keep.find((row) => row.released)?._count._all ?? 0;
   const kept = keep.find((row) => !row.released)?._count._all ?? 0;

   return {
      species,
      months: months.map((row) => ({
         month: String(row.month),
         count: num(row.n),
      })),
      keep: { released, kept },
      lengths: lengths.map((row) => ({
         bucket: num(row.bucket),
         count: num(row.n),
      })),
      weights: weights.map((row) => ({
         bucket: num(row.bucket),
         count: num(row.n),
      })),
   };
}

/* ---- 4. The water ------------------------------------------------------- */

/*
 * The nine provinces as rectangles, tried in order, first match wins.
 *
 * There is no province on a catch and no cheap way to get one: reverse
 * geocoding every position would be thousands of calls to somebody else's
 * service to draw one chart. So the map is read off, coarsely, and the
 * interface says "roughly" rather than pretending otherwise. The small
 * provinces are tried before the big ones they sit inside.
 *
 * Applied to a one-degree cell rather than to each catch, so the database
 * returns a few hundred rows at most and the naming is arithmetic over those.
 */
const PROVINCE_BOXES: {
   name: string;
   minLat: number;
   maxLat: number;
   minLng: number;
   maxLng: number;
}[] = [
   {
      name: 'Gauteng',
      minLat: -26.95,
      maxLat: -25.15,
      minLng: 27.05,
      maxLng: 29.1,
   },
   {
      name: 'KwaZulu-Natal',
      minLat: -31.6,
      maxLat: -26.8,
      minLng: 28.6,
      maxLng: 33.1,
   },
   {
      name: 'Mpumalanga',
      minLat: -27.4,
      maxLat: -24.3,
      minLng: 28.4,
      maxLng: 32.1,
   },
   {
      name: 'Limpopo',
      minLat: -25.3,
      maxLat: -22.1,
      minLng: 26.2,
      maxLng: 31.95,
   },
   {
      name: 'North West',
      minLat: -28.4,
      maxLat: -24.6,
      minLng: 22.6,
      maxLng: 28.45,
   },
   {
      name: 'Free State',
      minLat: -30.8,
      maxLat: -26.5,
      minLng: 24.2,
      maxLng: 29.9,
   },
   {
      name: 'Eastern Cape',
      minLat: -34.3,
      maxLat: -30.0,
      minLng: 24.2,
      maxLng: 30.4,
   },
   {
      name: 'Western Cape',
      minLat: -35.0,
      maxLat: -30.3,
      minLng: 17.3,
      maxLng: 24.3,
   },
   {
      name: 'Northern Cape',
      minLat: -33.0,
      maxLat: -24.7,
      minLng: 16.4,
      maxLng: 25.2,
   },
];

const provinceOf = (lat: number, lng: number): string => {
   for (const box of PROVINCE_BOXES) {
      if (
         lat >= box.minLat &&
         lat <= box.maxLat &&
         lng >= box.minLng &&
         lng <= box.maxLng
      ) {
         return box.name;
      }
   }
   return 'Elsewhere';
};

async function water() {
   const [spots, waters, cells, counts] = await Promise.all([
      /* The busiest spots. catchCount is kept on the row as catches are
         logged, so this is an ordered read of twenty five rows and not a
         count over the log. */
      prisma.fishingSite.findMany({
         where: { deletedAt: null },
         orderBy: [{ catchCount: 'desc' }, { likeCount: 'desc' }],
         take: 25,
         select: {
            id: true,
            name: true,
            waterType: true,
            visibility: true,
            catchCount: true,
            reviewCount: true,
            likeCount: true,
            latitude: true,
            longitude: true,
            createdBy: { select: { displayName: true, username: true } },
         },
      }),

      prisma.fishingSite.groupBy({
         by: ['waterType'],
         where: { deletedAt: null },
         _count: { _all: true },
      }),

      /*
       * Catches by one-degree cell. South Africa is about thirteen degrees
       * tall and seventeen across, so this comes back as a couple of hundred
       * rows whatever the size of the log.
       */
      prisma.$queryRaw<{ lat: unknown; lng: unknown; n: unknown }[]>`
         SELECT FLOOR(latitude) AS lat, FLOOR(longitude) AS lng, COUNT(*) AS n
           FROM \`Catch\`
          WHERE deletedAt IS NULL
            AND latitude IS NOT NULL AND longitude IS NOT NULL
          GROUP BY lat, lng`,

      prisma.fishingSite.groupBy({
         by: ['visibility'],
         where: { deletedAt: null },
         _count: { _all: true },
      }),
   ]);

   const byProvince = new Map<string, number>();
   for (const cell of cells) {
      /* The middle of the cell, so a cell is named by where it mostly is. */
      const name = provinceOf(num(cell.lat) + 0.5, num(cell.lng) + 0.5);
      byProvince.set(name, (byProvince.get(name) ?? 0) + num(cell.n));
   }

   return {
      spots: spots.map((spot) => ({
         id: spot.id,
         name: spot.name,
         waterType: spot.waterType,
         visibility: spot.visibility,
         catches: spot.catchCount,
         reviews: spot.reviewCount,
         likes: spot.likeCount,
         /* Whether it has a position, never where it is: a private spot's
            coordinates are the most closely held thing in the app and the
            panel has no question that needs them. */
         placed: spot.latitude !== null && spot.longitude !== null,
         owner: spot.createdBy?.displayName ?? null,
         ownerHandle: spot.createdBy?.username ?? null,
      })),
      waterTypes: waters.map((row) => ({
         key: row.waterType ?? 'UNKNOWN',
         count: row._count._all,
      })),
      provinces: [...byProvince.entries()]
         .map(([name, count]) => ({ name, count }))
         .sort((a, b) => b.count - a.count),
      visibility: counts.map((row) => ({
         key: row.visibility,
         count: row._count._all,
      })),
   };
}

/* ---- 5. The people ------------------------------------------------------ */

/*
 * The only place in the app where one person's email address is shown to
 * another, and it is shown to the admin alone. The route this hangs off
 * carries lib/admin.ts, which reads the role out of the database for every
 * request; there is no other way in and no client flag involved.
 */
async function people() {
   const [active, lately, noHandle, noCatch, totals] = await Promise.all([
      /*
       * The busiest anglers. Five counted columns, each a subquery on an
       * indexed foreign key, over the rows of users alone. This is the
       * heaviest read on the page: it is a scan of users with five lookups a
       * row, so it is capped at fifty out and will want a materialised figure
       * if the app ever has tens of thousands of anglers.
       */
      prisma.$queryRaw<
         {
            id: string;
            displayName: string;
            username: string | null;
            email: string;
            createdAt: Date;
            verified: unknown;
            catches: unknown;
            spots: unknown;
            comments: unknown;
            followers: unknown;
            following: unknown;
         }[]
      >`
         SELECT u.id, u.displayName, u.username, u.email, u.createdAt,
                u.verified,
                (SELECT COUNT(*) FROM \`Catch\` c
                  WHERE c.createdById = u.id AND c.deletedAt IS NULL) AS catches,
                (SELECT COUNT(*) FROM \`FishingSite\` s
                  WHERE s.createdById = u.id AND s.deletedAt IS NULL) AS spots,
                (SELECT COUNT(*) FROM \`FeedComment\` f
                  WHERE f.userId = u.id AND f.deletedAt IS NULL) AS comments,
                (SELECT COUNT(*) FROM \`Follow\` fo
                  WHERE fo.followingId = u.id) AS followers,
                (SELECT COUNT(*) FROM \`Follow\` fo
                  WHERE fo.followerId = u.id) AS following
           FROM users u
          WHERE u.deletedAt IS NULL
          ORDER BY catches DESC, spots DESC, comments DESC
          LIMIT 50`,

      prisma.user.findMany({
         where: { deletedAt: null },
         orderBy: { createdAt: 'desc' },
         take: 20,
         select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            emailVerified: true,
            createdAt: true,
         },
      }),

      prisma.user.findMany({
         where: { deletedAt: null, username: null },
         orderBy: { createdAt: 'desc' },
         take: 20,
         select: {
            id: true,
            displayName: true,
            email: true,
            emailVerified: true,
            createdAt: true,
         },
      }),

      prisma.user.findMany({
         where: { deletedAt: null, catches: { none: { deletedAt: null } } },
         orderBy: { createdAt: 'desc' },
         take: 20,
         select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            createdAt: true,
         },
      }),

      prisma.$queryRaw<{ metric: string; n: unknown }[]>`
         SELECT 'noHandle' AS metric, COUNT(*) AS n
           FROM users WHERE deletedAt IS NULL AND username IS NULL
         UNION ALL
         SELECT 'unverified', COUNT(*)
           FROM users WHERE deletedAt IS NULL AND emailVerified = 0
         UNION ALL
         SELECT 'noCatch', COUNT(*)
           FROM users u WHERE u.deletedAt IS NULL AND NOT EXISTS (
              SELECT 1 FROM \`Catch\` c
               WHERE c.createdById = u.id AND c.deletedAt IS NULL)
      `,
   ]);

   const total = (key: string) =>
      num(totals.find((row) => row.metric === key)?.n);

   return {
      active: active.map((row) => ({
         id: row.id,
         displayName: row.displayName,
         username: row.username,
         email: row.email,
         verified: Boolean(num(row.verified)),
         joinedAt: row.createdAt,
         catches: num(row.catches),
         spots: num(row.spots),
         comments: num(row.comments),
         followers: num(row.followers),
         following: num(row.following),
      })),
      lately: lately.map((row) => ({
         id: row.id,
         displayName: row.displayName,
         username: row.username,
         email: row.email,
         emailVerified: row.emailVerified,
         joinedAt: row.createdAt,
      })),
      noHandle: noHandle.map((row) => ({
         id: row.id,
         displayName: row.displayName,
         username: null,
         email: row.email,
         emailVerified: row.emailVerified,
         joinedAt: row.createdAt,
      })),
      noCatch: noCatch.map((row) => ({
         id: row.id,
         displayName: row.displayName,
         username: row.username,
         email: row.email,
         joinedAt: row.createdAt,
      })),
      counts: {
         noHandle: total('noHandle'),
         noCatch: total('noCatch'),
         unverified: total('unverified'),
      },
   };
}

/* ---- 6. The health of the thing ----------------------------------------- */

/*
 * What is stored, what is running, and what has been failing.
 *
 * Photographs are counted, not weighed: there is no byte size on an image row
 * and the upload path never writes one, so this says how many there are and
 * the panel says plainly that the volume is not recorded. A made-up average
 * multiplied by a count is a number that looks like a fact and is not one.
 */
async function health() {
   const [
      photos,
      onCatches,
      onSpots,
      competitions,
      entries,
      judgeOff,
      pushRows,
      species,
      feedPosts,
   ] = await Promise.all([
      prisma.$queryRaw<{ total: unknown; w7: unknown; w30: unknown }[]>`
         SELECT COUNT(*) AS total,
                SUM(createdAt >= ${daysAgo(7)}) AS w7,
                SUM(createdAt >= ${daysAgo(30)}) AS w30
           FROM \`Image\``,
      /*
       * How many photographs hang on a fish, not how many times one is hung.
       * CatchImage is a join and the same picture can sit on more than one
       * catch, so counting its rows gave a figure larger than the number of
       * photographs there are, which read on the panel as a contradiction:
       * 124 photos, 150 of them on catches. DISTINCT answers the question the
       * label actually asks.
       */
      prisma.$queryRaw<{ n: unknown }[]>`
         SELECT COUNT(DISTINCT imageId) AS n FROM \`CatchImage\``,
      prisma.$queryRaw<{ n: unknown }[]>`
         SELECT COUNT(DISTINCT imageId) AS n FROM \`SiteImage\``,
      prisma.competition.groupBy({
         by: ['state'],
         where: { deletedAt: null },
         _count: { _all: true },
      }),
      prisma.competitionEntry.groupBy({
         by: ['state'],
         _count: { _all: true },
      }),

      /*
       * The judge, when it did not run. It writes its own account into the
       * entry as JSON, so the reason is read out of the column rather than
       * guessed at from a null. A handful of reasons, so a handful of rows.
       */
      prisma.$queryRaw<{ reason: string | null; n: unknown }[]>`
         SELECT JSON_UNQUOTE(JSON_EXTRACT(judge, '$.reason')) AS reason,
                COUNT(*) AS n
           FROM competition_entries
          WHERE judge IS NOT NULL
            AND JSON_UNQUOTE(JSON_EXTRACT(judge, '$.status')) = 'unchecked'
          GROUP BY reason`,

      /*
       * Browsers that have asked to be told things, by kind. The user agent
       * is a long string nobody wants a hundred variants of, so it is sorted
       * into the four that matter in the query. Chrome last: every other
       * browser's agent also says the word.
       */
      prisma.$queryRaw<{ kind: string; n: unknown }[]>`
         SELECT CASE
                   WHEN userAgent IS NULL THEN 'Unknown'
                   WHEN userAgent LIKE '%Firefox%' THEN 'Firefox'
                   WHEN userAgent LIKE '%Edg/%' THEN 'Edge'
                   WHEN userAgent LIKE '%Chrome%' THEN 'Chrome'
                   WHEN userAgent LIKE '%Safari%' THEN 'Safari'
                   ELSE 'Other'
                END AS kind,
                COUNT(*) AS n
           FROM push_subscriptions
          GROUP BY kind ORDER BY n DESC`,

      prisma.species.count(),
      prisma.feedPost.count({ where: { deletedAt: null } }),
   ]);

   const judged = await prisma.competitionEntry.count({
      where: { judgedAt: { not: null } },
   });
   const entriesTotal = entries.reduce((sum, row) => sum + row._count._all, 0);

   return {
      photos: {
         total: num(photos[0]?.total),
         d7: num(photos[0]?.w7),
         d30: num(photos[0]?.w30),
         onCatches: num(onCatches[0]?.n),
         onSpots: num(onSpots[0]?.n),
         /* Said out loud rather than estimated. */
         bytesKnown: false,
      },
      competitions: competitions.map((row) => ({
         key: row.state,
         count: row._count._all,
      })),
      entries: {
         total: entriesTotal,
         judged,
         byState: entries.map((row) => ({
            key: row.state,
            count: row._count._all,
         })),
         /* Why the judge did not answer, when it did not. */
         unchecked: judgeOff.map((row) => ({
            reason: row.reason ?? 'unknown',
            count: num(row.n),
         })),
      },
      push: pushRows.map((row) => ({ kind: row.kind, count: num(row.n) })),
      /*
       * The last few sends this process remembers, already masked by the
       * mailer: it keeps twenty and drops the links, so there is no live
       * reset key sitting in memory to be read out here. Empty after a
       * restart, which the panel says rather than reading as "no mail sent".
       */
      mail: {
         transport: mailStatus.transport,
         domain: mailStatus.domain,
         recent: recentMail(),
      },
      build: {
         deployment: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
         /* Whether Claude can be reached at all. Says only that a key is
            set, never a word of it. */
         claude: process.env.ANTHROPIC_API_KEY?.trim() ? 'ready' : 'off',
      },
      reference: { species, feedPosts },
   };
}

/* ---- The sections ------------------------------------------------------- */

export const ADMIN_SECTIONS = [
   'overview',
   'growth',
   'fish',
   'water',
   'people',
   'health',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export const isAdminSection = (value: string): value is AdminSection =>
   (ADMIN_SECTIONS as readonly string[]).includes(value);

const READERS: Record<AdminSection, () => Promise<unknown>> = {
   overview,
   growth,
   fish,
   water,
   people,
   health,
};

export const adminService = {
   /*
    * One section, and how long it took. The timing rides along so the panel
    * can show what the page cost to draw: an admin page that quietly becomes
    * slow is one nobody notices until it times out.
    */
   async read(section: AdminSection) {
      const startedAt = Date.now();
      const data = await READERS[section]();
      return {
         section,
         generatedAt: new Date().toISOString(),
         ms: Date.now() - startedAt,
         data,
      };
   },
};
