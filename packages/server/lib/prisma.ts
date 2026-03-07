import dotenv from 'dotenv';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

dotenv.config({ override: true });

const isDevelopment = process.env.NODE_ENV !== 'production';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
   throw new Error('DATABASE_URL is required to initialize Prisma.');
}

const adapter = new PrismaMariaDb({ connectionString: databaseUrl });

export const prisma = new PrismaClient({
   adapter,
   log: isDevelopment ? ['query', 'warn', 'error'] : ['error'],
});
