import { gzipSync } from 'node:zlib';
import mysql from 'mysql2/promise';
import {
   DeleteObjectsCommand,
   GetObjectCommand,
   ListObjectsV2Command,
   PutObjectCommand,
   S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/*
 * A copy of the log, kept somewhere else.
 *
 * There were no backups at all: the database lives on Railway, whose own
 * backups are a dashboard setting nobody here can see, and the one control in
 * the app deletes for good. So the app takes its own: a plain SQL dump, gzipped
 * and put in the same bucket the photographs live in, every night and whenever
 * the team asks for one.
 *
 * Written with mysql2 rather than mysqldump, because the container has no
 * mysqldump in it and adding one to the image for this would be a strange way
 * to buy a file. The dump is the tables as they stand plus their rows, which
 * restores with any MySQL client:
 *
 *    gunzip -c fisherfeed-2026-09-23.sql.gz | mysql -h HOST -u USER -p DB
 *
 * It is a logical dump of one database, taken row by row. It is not a
 * point-in-time snapshot: a catch logged while it runs may or may not be in it.
 * For a log this size that is the right trade, and it is said out loud here
 * rather than discovered during a restore.
 */

const PREFIX = 'backups/';
const KEEP = 30;
/* Rows per SELECT, so a big table cannot take the server's memory with it. */
const PAGE = 500;

export type BackupFile = {
   key: string;
   /* The day it was taken, as its name reads. */
   name: string;
   takenAt: string | null;
   bytes: number;
};

const storage = () => {
   const account = process.env.CLOUDFLARE_ACCOUNT_ID;
   const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
   const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
   const bucket =
      process.env.CLOUDFLARE_R2_BUCKET?.trim() ||
      process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
   if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;
   return {
      bucket,
      client: new S3Client({
         region: 'auto',
         endpoint: `https://${account}.r2.cloudflarestorage.com`,
         credentials: { accessKeyId, secretAccessKey },
      }),
   };
};

/* MySQL's own quoting rules, so a note with a quote in it restores as it was. */
const literal = (value: unknown): string => {
   if (value === null || value === undefined) return 'NULL';
   if (typeof value === 'number')
      return Number.isFinite(value) ? String(value) : 'NULL';
   if (typeof value === 'boolean') return value ? '1' : '0';
   if (value instanceof Date)
      return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
   if (Buffer.isBuffer(value)) return `x'${value.toString('hex')}'`;
   const text =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
   return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\0/g, '\\0')}'`;
};

/** The whole database as one SQL script. Returns the gzipped bytes. */
export async function dumpDatabase(): Promise<{
   gz: Buffer;
   tables: number;
   rows: number;
}> {
   const url = process.env.DATABASE_URL?.trim();
   if (!url)
      throw new Error('DATABASE_URL is not set, so there is nothing to copy.');
   const parsed = new URL(url);
   const database = parsed.pathname.replace(/^\//, '');

   const link = await mysql.createConnection({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database,
      /* Dates and decimals as text, so what is written is what was stored. */
      dateStrings: true,
      decimalNumbers: false,
   });

   const parts: string[] = [
      `-- Fisherfeed, ${database}, taken ${new Date().toISOString()}`,
      '-- Restore with: gunzip -c <file> | mysql -h HOST -u USER -p DATABASE',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      '',
   ];
   let rows = 0;

   try {
      const [list] =
         await link.query<mysql.RowDataPacket[]>('SHOW FULL TABLES');
      const tables = list
         .map((row) => Object.values(row) as [string, string])
         .filter(([, kind]) => kind === 'BASE TABLE')
         .map(([name]) => name);

      for (const table of tables) {
         const [[created]] = await link.query<mysql.RowDataPacket[]>(
            `SHOW CREATE TABLE \`${table}\``
         );
         parts.push(
            `DROP TABLE IF EXISTS \`${table}\`;`,
            `${(created as Record<string, string>)['Create Table']};`,
            ''
         );

         for (let at = 0; ; at += PAGE) {
            const [page] = await link.query<mysql.RowDataPacket[]>(
               `SELECT * FROM \`${table}\` LIMIT ${PAGE} OFFSET ${at}`
            );
            if (page.length === 0) break;
            const columns = Object.keys(page[0]!)
               .map((column) => `\`${column}\``)
               .join(', ');
            const values = page
               .map((row) => `(${Object.values(row).map(literal).join(', ')})`)
               .join(',\n');
            parts.push(
               `INSERT INTO \`${table}\` (${columns}) VALUES\n${values};`
            );
            rows += page.length;
            if (page.length < PAGE) break;
         }
         parts.push('');
      }

      parts.push('SET FOREIGN_KEY_CHECKS = 1;', '');
      return {
         gz: gzipSync(Buffer.from(parts.join('\n'), 'utf8')),
         tables: tables.length,
         rows,
      };
   } finally {
      await link.end();
   }
}

export const backupService = {
   /** Take one now and put it in the bucket. */
   async take(): Promise<BackupFile & { tables: number; rows: number }> {
      const place = storage();
      if (!place) {
         throw new Error(
            'No storage keys are set, so a copy has nowhere to go.'
         );
      }
      const { gz, tables, rows } = await dumpDatabase();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = `${PREFIX}fisherfeed-${stamp}.sql.gz`;

      await place.client.send(
         new PutObjectCommand({
            Bucket: place.bucket,
            Key: key,
            Body: gz,
            ContentType: 'application/gzip',
         })
      );

      await backupService.prune();

      return {
         key,
         name: key.slice(PREFIX.length),
         takenAt: new Date().toISOString(),
         bytes: gz.byteLength,
         tables,
         rows,
      };
   },

   /** What is in the bucket, newest first. */
   async list(): Promise<BackupFile[]> {
      const place = storage();
      if (!place) return [];
      const answer = await place.client.send(
         new ListObjectsV2Command({
            Bucket: place.bucket,
            Prefix: PREFIX,
            MaxKeys: 200,
         })
      );
      return (answer.Contents ?? [])
         .map((object) => ({
            key: object.Key ?? '',
            name: (object.Key ?? '').slice(PREFIX.length),
            takenAt: object.LastModified?.toISOString() ?? null,
            bytes: object.Size ?? 0,
         }))
         .filter((file) => file.key)
         .sort((a, b) =>
            a.takenAt && b.takenAt ? b.takenAt.localeCompare(a.takenAt) : 0
         );
   },

   /** A link to one copy, good for ten minutes. */
   async linkTo(key: string): Promise<string | null> {
      const place = storage();
      if (!place || !key.startsWith(PREFIX)) return null;
      return getSignedUrl(
         place.client,
         new GetObjectCommand({ Bucket: place.bucket, Key: key }),
         { expiresIn: 600 }
      );
   },

   /* Thirty kept, which is a month of nights and costs pennies at this size. */
   async prune(): Promise<number> {
      const place = storage();
      if (!place) return 0;
      const files = await backupService.list();
      const old = files.slice(KEEP);
      if (old.length === 0) return 0;
      await place.client.send(
         new DeleteObjectsCommand({
            Bucket: place.bucket,
            Delete: {
               Objects: old.map((file) => ({ Key: file.key })),
               Quiet: true,
            },
         })
      );
      return old.length;
   },
};

/*
 * A copy every night at two in the morning, South African time, which is the
 * quietest hour for a fishing log. A timer rather than a cron service: there is
 * one server, and a job that only runs while it does is the honest shape of
 * this. Every run says what happened in the log, so a week of silence is
 * visible rather than assumed.
 */
export function startNightlyBackups() {
   if (!storage()) {
      console.warn('[backup] No storage keys, so no copies will be taken.');
      return;
   }

   const nextTwo = () => {
      const now = new Date();
      /* Two in the morning in Johannesburg, which is UTC+2 all year. */
      const next = new Date(now);
      next.setUTCHours(0, 0, 0, 0);
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      return next.getTime() - now.getTime();
   };

   const run = async () => {
      try {
         const file = await backupService.take();
         console.warn('[backup] Copy taken.', {
            name: file.name,
            bytes: file.bytes,
            tables: file.tables,
            rows: file.rows,
         });
      } catch (error) {
         console.error('[backup] Could not take a copy.', error);
      } finally {
         setTimeout(() => void run(), nextTwo()).unref?.();
      }
   };

   setTimeout(() => void run(), nextTwo()).unref?.();
}
