import { spawn } from 'node:child_process';

function getServerUrl(databaseUrl: string) {
   const parsed = new URL(databaseUrl);
   const databaseName = parsed.pathname.replace(/^\//, '');

   if (!databaseName) {
      throw new Error('DATABASE_URL must include a database name in the path.');
   }

   parsed.pathname = '/mysql';

   return {
      serverUrl: parsed.toString(),
      databaseName,
   };
}

function runPrismaExecute(serverUrl: string, sql: string) {
   return new Promise<void>((resolve, reject) => {
      const child = spawn(
         'bunx',
         ['prisma', 'db', 'execute', '--url', serverUrl, '--stdin'],
         {
            stdio: ['pipe', 'inherit', 'inherit'],
         }
      );

      child.on('error', reject);
      child.stdin.write(sql);
      child.stdin.end();

      child.on('close', (code) => {
         if (code === 0) {
            resolve();
            return;
         }

         reject(new Error(`prisma db execute exited with code ${code}`));
      });
   });
}

async function createDatabase() {
   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl) {
      throw new Error('DATABASE_URL is required.');
   }

   const { serverUrl, databaseName } = getServerUrl(databaseUrl);
   const escapedName = `\`${databaseName.replace(/`/g, '``')}\``;

   await runPrismaExecute(
      serverUrl,
      `CREATE DATABASE IF NOT EXISTS ${escapedName};`
   );

   console.log(`Database "${databaseName}" is ready.`);
}

createDatabase().catch((error) => {
   console.error(error instanceof Error ? error.message : error);
   process.exit(1);
});
