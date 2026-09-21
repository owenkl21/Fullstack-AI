import { randomUUID } from 'node:crypto';
import {
   S3Client,
   GetObjectCommand,
   PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { currentViewerPrefix } from '../lib/auth-context';

type UploadScope = 'catch' | 'site' | 'avatar' | 'banner' | 'gear';

/*
 * ---------------------------------------------------------------------------
 * The variant naming convention. This is the one place it is written down.
 * ---------------------------------------------------------------------------
 *
 * A photograph is stored three times under one base key:
 *
 *   <key>              the original, exactly as the camera wrote it
 *   <key>.card.jpg     900px on the long edge, for a card or a tile
 *   <key>.thumb.jpg    160px on the long edge, for a row or an avatar
 *
 * Suffixes rather than a second folder, and appended rather than substituted,
 * so the base key stays a complete key and the two others are derivable from
 * it by a string. That is what lets the Image row keep holding one key and no
 * column be added for this: anything that has the base can rebuild the other
 * two without asking the database or the bucket.
 *
 * The browser makes the two variants at upload time (client src/lib/images.ts)
 * and PUTs all three; audit/backfill-images.mjs makes them for photographs that
 * were already in the bucket. Both use the names above and neither invents
 * them: this file is the source.
 */
const VARIANT_SUFFIX = {
   card: '.card.jpg',
   thumb: '.thumb.jpg',
} as const;

export type ImageVariant = keyof typeof VARIANT_SUFFIX;

/** The key a variant of `storageKey` lives under. */
const variantKey = (storageKey: string, variant: ImageVariant) =>
   `${storageKey}${VARIANT_SUFFIX[variant]}`;

type SignUploadInput = {
   storagePrefixId: string;
   scope: UploadScope;
   fileName: string;
   contentType: 'image/jpeg' | 'image/png' | 'image/webp';
   sizeBytes: number;
   /* Which resized copies the browser is about to send up beside the original.
    * An old client sends none and still works; it simply has no variants. */
   variants?: readonly ImageVariant[];
};

const requiredEnv = [
   'CLOUDFLARE_ACCOUNT_ID',
   'CLOUDFLARE_R2_ACCESS_KEY_ID',
   'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
] as const;

const resolveBucket = () =>
   process.env.CLOUDFLARE_R2_BUCKET?.trim() ||
   process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();

const getConfig = () => {
   for (const key of requiredEnv) {
      if (!process.env[key]) {
         throw new Error(`Missing required environment variable: ${key}`);
      }
   }

   const bucket = resolveBucket();

   if (!bucket) {
      throw new Error(
         'Missing required environment variable: CLOUDFLARE_R2_BUCKET (or CLOUDFLARE_R2_BUCKET_NAME).'
      );
   }

   return {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      bucket,
      publicBaseUrl: process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL,
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      maxUploadSizeBytes: 10 * 1024 * 1024,
   };
};

let s3Client: S3Client | null = null;

const getS3Client = () => {
   if (s3Client) {
      return s3Client;
   }

   const config = getConfig();

   s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: false,
      credentials: {
         accessKeyId: config.accessKeyId,
         secretAccessKey: config.secretAccessKey,
      },
   });

   return s3Client;
};

const slugify = (value: string) =>
   value
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70);

const extensionByMime: Record<SignUploadInput['contentType'], string> = {
   'image/jpeg': 'jpg',
   'image/png': 'png',
   'image/webp': 'webp',
};

const buildStorageKey = ({
   storagePrefixId,
   scope,
   fileName,
   contentType,
}: Pick<
   SignUploadInput,
   'storagePrefixId' | 'scope' | 'fileName' | 'contentType'
>) => {
   const timestamp = Date.now();
   const safeSlug = slugify(fileName) || 'image';
   const extension = extensionByMime[contentType];
   const randomSuffix = randomUUID().slice(0, 8);

   /* The two pictures of the angler live beside each other, not in a temp
    * folder: they are kept until replaced, never promoted from a draft. */
   if (scope === 'avatar' || scope === 'banner') {
      return `users/${storagePrefixId}/${scope}/${timestamp}-${randomSuffix}-${safeSlug}.${extension}`;
   }

   const pathSegment =
      scope === 'catch' ? 'catches' : scope === 'site' ? 'sites' : 'gear';

   return `users/${storagePrefixId}/${pathSegment}/temp/${timestamp}-${randomSuffix}-${safeSlug}.${extension}`;
};

const buildUnsignedObjectUrl = (storageKey: string) => {
   const { endpoint, bucket } = getConfig();

   return `${endpoint}/${bucket}/${storageKey
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
};

/*
 * Signing is the other thing that made the feed slow.
 *
 * A presigned URL is an HMAC over the key and the clock, computed fresh every
 * time it is asked for, and one feed page asked for the same angler's avatar
 * twenty five times. Signatures live ten minutes, so holding one for eight is
 * safe by two: a URL handed out at the end of its cached life still has two
 * minutes of its own left, which is longer than any reader spends between the
 * response and the picture appearing.
 *
 * Module level rather than per request on purpose. The whole point is that the
 * second page of a scroll does not re-sign what the first page just signed.
 */
const READ_URL_TTL_MS = 8 * 60 * 1000;
const READ_URL_CACHE_MAX = 2000;
const readUrlCache = new Map<string, { url: string; expiresAt: number }>();

const rememberReadUrl = (storageKey: string, url: string) => {
   /* Oldest first, because a Map iterates in insertion order and a bucket of
    * keys nobody is reading any more is the part worth dropping. */
   if (readUrlCache.size >= READ_URL_CACHE_MAX) {
      const now = Date.now();
      for (const [key, entry] of readUrlCache) {
         if (entry.expiresAt <= now) readUrlCache.delete(key);
      }
      while (readUrlCache.size >= READ_URL_CACHE_MAX) {
         const oldest = readUrlCache.keys().next();
         if (oldest.done) break;
         readUrlCache.delete(oldest.value);
      }
   }

   readUrlCache.set(storageKey, {
      url,
      expiresAt: Date.now() + READ_URL_TTL_MS,
   });
};

const resolveReadUrl = async (storageKey: string) => {
   const { publicBaseUrl, bucket } = getConfig();

   if (publicBaseUrl) {
      const base = publicBaseUrl.replace(/\/+$/, '');
      return `${base}/${storageKey}`;
   }

   const cached = readUrlCache.get(storageKey);
   if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
   }

   const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
   });

   const url = await getSignedUrl(getS3Client(), command, {
      expiresIn: 60 * 10,
   });

   rememberReadUrl(storageKey, url);

   return url;
};

/*
 * The three URLs for one photograph, signed together.
 *
 * `url` is kept exactly as it always was so that every reader that only knows
 * about one picture carries on working; the other two are what a list should
 * actually be drawing.
 */
const resolveReadUrls = async (storageKey: string) => {
   const [url, cardUrl, thumbUrl] = await Promise.all([
      resolveReadUrl(storageKey),
      resolveReadUrl(variantKey(storageKey, 'card')),
      resolveReadUrl(variantKey(storageKey, 'thumb')),
   ]);

   return { url, cardUrl, thumbUrl };
};

const buildSignedUploadUrl = async ({
   storageKey,
   contentType,
}: {
   storageKey: string;
   contentType: SignUploadInput['contentType'];
}) => {
   const { bucket } = getConfig();

   const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
   });

   return getSignedUrl(getS3Client(), command, {
      expiresIn: 60 * 5,
   });
};

const inferScopeFromStorageKey = (
   storagePrefixId: string,
   storageKey: string
): UploadScope => {
   const catchPrefix = `users/${storagePrefixId}/catches/temp/`;
   const sitePrefix = `users/${storagePrefixId}/sites/temp/`;
   const avatarPrefix = `users/${storagePrefixId}/avatar/`;
   const bannerPrefix = `users/${storagePrefixId}/banner/`;
   const gearPrefix = `users/${storagePrefixId}/gear/temp/`;

   if (storageKey.startsWith(catchPrefix)) {
      return 'catch';
   }

   if (storageKey.startsWith(sitePrefix)) {
      return 'site';
   }

   if (storageKey.startsWith(avatarPrefix)) {
      return 'avatar';
   }

   if (storageKey.startsWith(bannerPrefix)) {
      return 'banner';
   }

   if (storageKey.startsWith(gearPrefix)) {
      return 'gear';
   }

   throw new Error('Storage key does not match authenticated user and scope.');
};

const assertUploadSize = (sizeBytes: number) => {
   const { maxUploadSizeBytes } = getConfig();

   if (sizeBytes > maxUploadSizeBytes) {
      throw new Error(
         `File exceeds maximum upload size of ${maxUploadSizeBytes} bytes.`
      );
   }
};

export const uploadsService = {
   inferScopeFromStorageKey,
   async signUpload(input: SignUploadInput) {
      assertUploadSize(input.sizeBytes);

      const storageKey = buildStorageKey(input);
      const wanted = input.variants ?? [];

      /*
       * One base key, one upload URL per size. The variants are always JPEG,
       * whatever the original was: a canvas writes what it is told to and a
       * photograph has nothing to gain from PNG.
       */
      const [uploadUrl, readUrls, variants] = await Promise.all([
         buildSignedUploadUrl({
            storageKey,
            contentType: input.contentType,
         }),
         resolveReadUrls(storageKey),
         Promise.all(
            wanted.map(async (variant) => ({
               variant,
               storageKey: variantKey(storageKey, variant),
               contentType: 'image/jpeg' as const,
               uploadUrl: await buildSignedUploadUrl({
                  storageKey: variantKey(storageKey, variant),
                  contentType: 'image/jpeg',
               }),
            }))
         ),
      ]);

      return {
         storageKey,
         uploadUrl,
         /* Unchanged, and still the original. */
         readUrl: readUrls.url,
         cardReadUrl: readUrls.cardUrl,
         thumbReadUrl: readUrls.thumbUrl,
         variants,
      };
   },

   async getReadUrl(storageKey: string) {
      /*
       * A key that starts with / is a file the client serves out of public/,
       * not an R2 object. Presigning it hands back a signed URL for something
       * that was never uploaded, which is what broke every seeded photograph.
       * Every image resolver funnels through here, so this is the one place
       * that needs to know. A file on disk has no variants either, so all
       * three answers are the same path and the browser picks it once.
       */
      if (storageKey.startsWith('/')) {
         return {
            storageKey,
            readUrl: storageKey,
            cardReadUrl: storageKey,
            thumbReadUrl: storageKey,
         };
      }

      const urls = await resolveReadUrls(storageKey);

      /*
       * The original is the camera's file, EXIF and all, and a phone writes
       * where the photograph was taken into it. So a catch with its position
       * hidden still gave the spot away to anyone who opened the picture.
       * Only the owner is handed the original now. Everyone else gets the
       * card, 1200 across, which the browser drew on a canvas and which
       * carries no tags. The key says whose it is: every upload lives under
       * users/<storagePrefixId>/, and the viewer comes from the request.
       */
      const viewer = currentViewerPrefix();
      const ownsIt =
         viewer !== null && storageKey.startsWith(`users/${viewer}/`);

      return {
         storageKey,
         readUrl: ownsIt ? urls.url : urls.cardUrl,
         cardReadUrl: urls.cardUrl,
         thumbReadUrl: urls.thumbUrl,
      };
   },

   async getDirectUploadData(input: {
      storagePrefixId: string;
      scope: UploadScope;
      storageKey: string;
      contentType: SignUploadInput['contentType'];
   }) {
      const expectedPathSegment =
         input.scope === 'avatar' || input.scope === 'banner'
            ? input.scope
            : input.scope === 'catch'
              ? 'catches/temp'
              : input.scope === 'site'
                ? 'sites/temp'
                : 'gear/temp';
      const expectedPrefix = `users/${input.storagePrefixId}/${expectedPathSegment}/`;

      if (!input.storageKey.startsWith(expectedPrefix)) {
         throw new Error(
            'Storage key does not match authenticated user and scope.'
         );
      }

      return {
         storageKey: input.storageKey,
         uploadUrl: await buildSignedUploadUrl({
            storageKey: input.storageKey,
            contentType: input.contentType,
         }),
         readUrl: await resolveReadUrl(input.storageKey),
         objectUrl: buildUnsignedObjectUrl(input.storageKey),
      };
   },

   async proxyUpload(input: {
      storagePrefixId: string;
      scope: UploadScope;
      storageKey: string;
      contentType: SignUploadInput['contentType'];
      body: Buffer;
   }) {
      const expectedPathSegment =
         input.scope === 'avatar' || input.scope === 'banner'
            ? input.scope
            : input.scope === 'catch'
              ? 'catches/temp'
              : input.scope === 'site'
                ? 'sites/temp'
                : 'gear/temp';
      const expectedPrefix = `users/${input.storagePrefixId}/${expectedPathSegment}/`;

      if (!input.storageKey.startsWith(expectedPrefix)) {
         throw new Error(
            'Storage key does not match authenticated user and scope.'
         );
      }

      const { bucket } = getConfig();

      await getS3Client().send(
         new PutObjectCommand({
            Bucket: bucket,
            Key: input.storageKey,
            Body: input.body,
            ContentType: input.contentType,
         })
      );

      return {
         storageKey: input.storageKey,
         readUrl: await resolveReadUrl(input.storageKey),
      };
   },
};
