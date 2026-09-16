import { defineRailway, github, preserve, project, service } from 'railway/iac';

/*
 * Infrastructure as Code, replacing the deprecated railway.json. Config as Code
 * stops working on 1 December 2026.
 *
 * Two things the generated migration got wrong, both of which would have broken
 * the deploy:
 *
 * 1. It named the service "Fullstack-AI", after the directory. The live service
 *    is "server", and pointing at the wrong name would have created a second one.
 * 2. It declared no variables and no source. IaC is declarative, so `railway
 *    config plan` showed it deleting all eight environment variables, including
 *    DATABASE_URL and every key, and unsetting the GitHub source.
 *
 * `preserve()` is the answer to the second: it says the variable exists and is
 * managed outside this file, so Railway leaves the value alone. No secret is
 * ever written here. Set or rotate them with `railway variable set`, or in the
 * dashboard.
 */
export const partial = 'server';

export default defineRailway(() => {
   const server = service('server', {
      source: github('owenkl21/fishlogger'),

      /*
       * Build at the repo root, because that is where bun.lock and the
       * workspaces array live, so that is where bun install has to run.
       */
      build: 'bun install && cd packages/server && bun run prisma:generate',
      start: 'cd packages/server && bun run start',

      /*
       * /api/hello rather than /, because it exercises the same /api prefix
       * Vercel proxies. Both are trivial handlers that touch no database.
       */
      healthcheck: '/api/hello',
      healthcheckTimeout: 60,

      deploy: {
         restartPolicyType: 'ON_FAILURE',
         restartPolicyMaxRetries: 10,
      },

      /*
       * Declared, never valued. DATABASE_URL is a reference to the MySQL
       * service rather than a literal, so it follows the database and
       * hardcodes no password.
       */
      variables: {
         DATABASE_URL: preserve(),
         CLERK_PUBLISHABLE_KEY: preserve(),
         CLERK_SECRET_KEY: preserve(),
         OPENAI_API_KEY: preserve(),
         CLOUDFLARE_ACCOUNT_ID: preserve(),
         CLOUDFLARE_R2_ACCESS_KEY_ID: preserve(),
         CLOUDFLARE_R2_SECRET_ACCESS_KEY: preserve(),
         CLOUDFLARE_R2_BUCKET: preserve(),
      },
   });

   return project('fishlogger', {
      resources: [server],
   });
});
