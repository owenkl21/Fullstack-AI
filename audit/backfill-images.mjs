/*
 * Make the two smaller copies of every photograph already in the bucket.
 *
 * New uploads resize themselves in the browser before they go up. Everything
 * logged before that does not, which is why the feed was handing a 4284 by
 * 5712 original to a 40px avatar. This walks the bucket once and puts a card
 * and a thumb beside every original that has none.
 *
 * The naming convention is the server's and is written down in one place,
 * packages/server/services/uploads.service.ts:
 *
 *   <key>            the original
 *   <key>.card.jpg   1200px wide
 *   <key>.thumb.jpg  256px wide
 *
 * Safe to run again: a key that already has both copies is counted and
 * skipped, so a run that was interrupted picks up where it stopped. Nothing is
 * ever deleted and no original is ever written over.
 *
 *   cd audit && npm install
 *   node backfill-images.mjs            # do the work
 *   node backfill-images.mjs --dry-run  # say what it would do and stop
 *
 * The credentials come out of packages/server/.env and are never printed.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
   S3Client,
   GetObjectCommand,
   HeadObjectCommand,
   ListObjectsV2Command,
   PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, '../packages/server/.env');

/* The same two sizes and qualities the browser uses, so a photograph looks the
 * same whether it went up today or was backfilled. See client/src/lib/images.ts. */
const VARIANTS = [
   { suffix: '.card.jpg', width: 1200, quality: 80 },
   { suffix: '.thumb.jpg', width: 256, quality: 74 },
];

const IMAGE_KEY = /\.(jpe?g|png|webp)$/i;

const dryRun = process.argv.includes('--dry-run');

/* A small reader rather than dotenv, so the audit folder keeps three
 * dependencies instead of four. Quotes around a value are stripped; a line
 * without an equals sign, or starting with a hash, is not a variable. */
function readEnv(path) {
   let text;
   try {
      text = readFileSync(path, 'utf8');
   } catch {
      throw new Error(
         `Could not read ${path}. The bucket credentials live there.`
      );
   }

   const out = {};
   for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const at = trimmed.indexOf('=');
      if (at < 1) continue;
      const key = trimmed.slice(0, at).trim();
      let value = trimmed.slice(at + 1).trim();
      if (
         (value.startsWith('"') && value.endsWith('"')) ||
         (value.startsWith("'") && value.endsWith("'"))
      ) {
         value = value.slice(1, -1);
      }
      out[key] = value;
   }
   return out;
}

function configure(env) {
   const accountId = env.CLOUDFLARE_ACCOUNT_ID;
   const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
   const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
   const bucket = env.CLOUDFLARE_R2_BUCKET || env.CLOUDFLARE_R2_BUCKET_NAME;

   const missing = [
      ['CLOUDFLARE_ACCOUNT_ID', accountId],
      ['CLOUDFLARE_R2_ACCESS_KEY_ID', accessKeyId],
      ['CLOUDFLARE_R2_SECRET_ACCESS_KEY', secretAccessKey],
      ['CLOUDFLARE_R2_BUCKET', bucket],
   ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

   if (missing.length) {
      throw new Error(
         `${ENV_FILE} is missing ${missing.join(', ')}. Set those and run again.`
      );
   }

   const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
   });

   return { client, bucket };
}

async function listEverything(client, bucket) {
   const keys = new Set();
   let token;
   let pages = 0;

   do {
      const page = await client.send(
         new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: token,
            MaxKeys: 1000,
         })
      );
      for (const object of page.Contents ?? []) {
         if (object.Key) keys.add(object.Key);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
      pages += 1;
   } while (token);

   console.log(`Read ${keys.size} objects over ${pages} listings.`);
   return keys;
}

async function readObject(client, bucket, key) {
   const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
   );
   const chunks = [];
   for await (const chunk of object.Body) chunks.push(chunk);
   return Buffer.concat(chunks);
}

const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;

async function main() {
   const { client, bucket } = configure(readEnv(ENV_FILE));

   console.log(
      dryRun
         ? `Reading ${bucket}. Nothing will be written.`
         : `Reading ${bucket}.`
   );

   const keys = await listEverything(client, bucket);

   const originals = [...keys]
      .filter((key) => !VARIANTS.some((v) => key.endsWith(v.suffix)))
      .filter((key) => IMAGE_KEY.test(key))
      .sort();

   /*
    * --force remakes what is already there. The sizes these are cut to are a
    * judgement that can change, and it changed once already: a copy made to an
    * older rule is not missing, it is wrong, and only this tells the two apart.
    */
   const force = process.argv.includes('--force');
   const work = originals
      .map((key) => ({
         key,
         missing: force
            ? VARIANTS
            : VARIANTS.filter((v) => !keys.has(`${key}${v.suffix}`)),
      }))
      .filter((entry) => entry.missing.length > 0);

   console.log(
      `${originals.length} photographs, ${originals.length - work.length} already done, ${work.length} to do.`
   );

   if (work.length === 0) {
      console.log('Nothing to do.');
      return;
   }

   if (dryRun) {
      for (const entry of work) {
         console.log(
            `would write ${entry.missing.map((v) => v.suffix).join(' and ')} for ${entry.key}`
         );
      }
      console.log(`\nDry run. ${work.length} photographs would be resized.`);
      return;
   }

   let done = 0;
   let failed = 0;
   let sourceBytes = 0;
   let writtenBytes = 0;

   for (const entry of work) {
      try {
         /* One read of the original, both copies out of it. A HEAD first, so a
          * key that vanished between the listing and now is a skip rather than
          * a stack trace. */
         await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: entry.key })
         );

         const source = await readObject(client, bucket, entry.key);
         sourceBytes += source.length;

         for (const variant of entry.missing) {
            const body = await sharp(source)
               /* The camera's orientation tag, applied and then dropped, so a
                * fish held up sideways comes out the right way up. */
               .rotate()
               .resize(variant.width, null, {
                  fit: 'inside',
                  withoutEnlargement: true,
               })
               .jpeg({ quality: variant.quality })
               .toBuffer();

            await client.send(
               new PutObjectCommand({
                  Bucket: bucket,
                  Key: `${entry.key}${variant.suffix}`,
                  Body: body,
                  ContentType: 'image/jpeg',
               })
            );

            writtenBytes += body.length;
            console.log(
               `${entry.key}${variant.suffix}  ${kb(source.length)} to ${kb(body.length)}`
            );
         }

         done += 1;
      } catch (error) {
         failed += 1;
         console.warn(`could not resize ${entry.key}: ${error.message}`);
      }
   }

   console.log(
      `\n${done} photographs resized, ${failed} left alone. Read ${kb(sourceBytes)}, wrote ${kb(writtenBytes)}.`
   );
   if (failed > 0) {
      console.log('Run it again to retry the ones that failed.');
   }
}

main().catch((error) => {
   console.error(error.message);
   process.exitCode = 1;
});
