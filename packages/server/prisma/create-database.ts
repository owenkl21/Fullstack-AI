import mysql from 'mysql2/promise';

function getServerConfig(databaseUrl: string) {
   const parsed = new URL(databaseUrl);
   const databaseName = parsed.pathname.replace(/^\//, '');

   if (!databaseName) {
      throw new Error('DATABASE_URL must include a database name in the path.');
   }

   return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      databaseName,
   };
}

async function createDatabase() {
   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl) {
      throw new Error('DATABASE_URL is required.');
   }

   const { host, port, user, password, databaseName } =
      getServerConfig(databaseUrl);

   const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
   });

   const escapedName = `\`${databaseName.replace(/`/g, '``')}\``;

   await connection.execute(`CREATE DATABASE IF NOT EXISTS ${escapedName}`);
   await connection.end();

   console.log(`Database "${databaseName}" is ready.`);
}

createDatabase().catch((error) => {
   console.error(error instanceof Error ? error.message : error);
   process.exit(1);
});
