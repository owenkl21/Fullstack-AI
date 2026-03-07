import dotenv from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';

dotenv.config({ override: true });

const isDevelopment = process.env.NODE_ENV !== 'production';
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
   throw new Error('DATABASE_URL is required to initialize Prisma.');
}

const baseLogs: Prisma.LogLevel[] = isDevelopment
   ? ['query', 'warn', 'error']
   : ['error'];

let prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] = {
   log: baseLogs,
};

export const prisma = new PrismaClient(prismaClientOptions);

if (isDevelopment) {
   const connectionTarget = (() => {
      try {
         const parsed = new URL(databaseUrl);
         return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '3306'}/${parsed.pathname.replace(/^\//, '')}`;
      } catch {
         return databaseUrl;
      }
   })();

   console.info('[prisma] Initialized client.', {
      adapter: 'prisma-engine',
      connectionTarget,
   });
}
