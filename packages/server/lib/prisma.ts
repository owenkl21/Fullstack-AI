import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma/client';

dotenv.config({ override: true });

const isDevelopment = process.env.NODE_ENV !== 'production';
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
   throw new Error('DATABASE_URL is required to initialize Prisma.');
}

export const prisma = new PrismaClient({
   datasourceUrl: databaseUrl,
   log: isDevelopment ? ['query', 'warn', 'error'] : ['error'],
});
