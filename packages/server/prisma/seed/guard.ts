/*
 * Three refusals before the seed writes anything.
 *
 * This matters more than it looks. Every seeded catch creates a GLOBAL feed
 * post, and listFeed has no author filter, so fifty fabricated catches by eight
 * fabricated anglers become the public feed for whoever signs in next. On a
 * database real people use, that is not test data, it is vandalism.
 */

const ALLOWED_DATABASES = new Set([
   'fishing_app',
   'fishing_app_dev',
   'fishing_app_test',
   /* Railway names every database it provisions this. */
   'railway',
]);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type SeedTarget = { host: string; database: string };

export function assertSeedable(): SeedTarget {
   const url = process.env.DATABASE_URL?.trim();

   if (!url) {
      throw new Error('DATABASE_URL is not set. Refusing to seed.');
   }

   let parsed: URL;

   try {
      parsed = new URL(url);
   } catch {
      throw new Error('DATABASE_URL is not a URL. Refusing to seed.');
   }

   const host = parsed.hostname;
   const database = parsed.pathname.replace(/^\//, '');

   /*
    * 1. Not production, unless somebody said so on purpose.
    *
    * Railway sets NODE_ENV=production in every container it runs, including the
    * one environment this app has, so a blanket refusal here means the seed can
    * never run at all. The override is a separate variable rather than a
    * loosening of the others: seeding a production-labelled database needs the
    * host named, the seed confirmed, AND this, three independent acts.
    */
   if (
      process.env.NODE_ENV === 'production' &&
      process.env.SEED_ALLOW_PRODUCTION?.trim() !== 'yes'
   ) {
      throw new Error(
         'NODE_ENV is production. Set SEED_ALLOW_PRODUCTION=yes to seed anyway, ' +
            'and be sure no real person is using this database.'
      );
   }

   // 2. Local by default. A remote host has to be named exactly, and confirmed.
   if (!LOCAL_HOSTS.has(host)) {
      const allowed = process.env.SEED_ALLOW_REMOTE_HOST?.trim();

      if (allowed !== host) {
         throw new Error(
            `DATABASE_URL points at ${host}, which is not local. ` +
               `Set SEED_ALLOW_REMOTE_HOST=${host} to allow it, and know that ` +
               `seeded posts become the feed for everyone who signs in.`
         );
      }

      if (process.env.SEED_CONFIRM?.trim() !== 'yes') {
         throw new Error(
            `Seeding ${database} on ${host} needs SEED_CONFIRM=yes as well.`
         );
      }
   }

   // 3. A database this seed is meant for, so a typo cannot hit a neighbour.
   if (!ALLOWED_DATABASES.has(database)) {
      throw new Error(
         `Database "${database}" is not in the seed allowlist. Refusing to seed.`
      );
   }

   console.log(`[seed] writing to ${database} on ${host}`);

   return { host, database };
}
