import dotenv from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

dotenv.config({ override: true });

const isDevelopment = process.env.NODE_ENV !== 'production';
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
   throw new Error('DATABASE_URL is required to initialize Prisma.');
}

const parsed = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
   host: parsed.hostname,
   port: parsed.port ? Number(parsed.port) : 3306,
   user: decodeURIComponent(parsed.username),
   password: decodeURIComponent(parsed.password),
   database: parsed.pathname.replace(/^\//, ''),
});

const baseLogs: Prisma.LogLevel[] = isDevelopment
   ? ['query', 'warn', 'error']
   : ['error'];

const globalForPrisma = globalThis as typeof globalThis & {
   prisma?: PrismaClient;
};

export const prisma =
   globalForPrisma.prisma ??
   new PrismaClient({
      adapter,
      log: baseLogs,
   });

if (isDevelopment) {
   globalForPrisma.prisma = prisma;

   console.info('[prisma] Initialized client.', {
      adapter: '@prisma/adapter-mariadb',
      connectionTarget: `${parsed.protocol}//${parsed.hostname}:${parsed.port || '3306'}/${parsed.pathname.replace(/^\//, '')}`,
   });
}
