import dotenv from 'dotenv';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

dotenv.config({ override: true });

const isDevelopment = process.env.NODE_ENV !== 'production';
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
   throw new Error('DATABASE_URL is required to initialize Prisma.');
}

type PrismaMariaDbCtor = new (options: { connectionString: string }) => unknown;

const require = createRequire(import.meta.url);
const { PrismaMariaDb } = require('@prisma/adapter-mariadb') as {
   PrismaMariaDb: PrismaMariaDbCtor;
};

const adapter = new PrismaMariaDb({ connectionString: databaseUrl });

export const prisma = new PrismaClient({
   adapter: adapter as never,
   log: isDevelopment ? ['query', 'warn', 'error'] : ['error'],
});
