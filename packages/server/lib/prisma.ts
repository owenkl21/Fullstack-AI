import { PrismaClient } from '../generated/prisma/client';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const prisma = new PrismaClient({
   accelerateUrl: process.env.DATABASE_URL ?? '',
   log: isDevelopment ? ['query', 'warn', 'error'] : ['error'],
});
