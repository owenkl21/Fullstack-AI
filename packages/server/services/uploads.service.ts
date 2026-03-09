import { randomUUID } from 'node:crypto';
import {
   S3Client,
   GetObjectCommand,
   PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type UploadScope = 'catch' | 'site' | 'avatar';

type SignUploadInput = {
   clerkUserId: string;
   scope: UploadScope;
   fileName: string;
   contentType: 'image/jpeg' | 'image/png' | 'image/webp';
   sizeBytes: number;
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
   clerkUserId,
   scope,
   fileName,
   contentType,
}: Pick<
   SignUploadInput,
   'clerkUserId' | 'scope' | 'fileName' | 'contentType'
>) => {
   const timestamp = Date.now();
   const safeSlug = slugify(fileName) || 'image';
   const extension = extensionByMime[contentType];
   const randomSuffix = randomUUID().slice(0, 8);

   if (scope === 'avatar') {
      return `users/${clerkUserId}/avatar/${timestamp}-${randomSuffix}-${safeSlug}.${extension}`;
   }

   const pathSegment = scope === 'catch' ? 'catches' : 'sites';

   return `users/${clerkUserId}/${pathSegment}/temp/${timestamp}-${randomSuffix}-${safeSlug}.${extension}`;
};

const buildUnsignedObjectUrl = (storageKey: string) => {
   const { endpoint, bucket } = getConfig();

   return `${endpoint}/${bucket}/${storageKey
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
};

const resolveReadUrl = async (storageKey: string) => {
   const { publicBaseUrl, bucket } = getConfig();

   if (publicBaseUrl) {
      const base = publicBaseUrl.replace(/\/+$/, '');
      return `${base}/${storageKey}`;
   }

   const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
   });

   return getSignedUrl(getS3Client(), command, {
      expiresIn: 60 * 10,
   });
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
   clerkUserId: string,
   storageKey: string
): UploadScope => {
   const catchPrefix = `users/${clerkUserId}/catches/temp/`;
   const sitePrefix = `users/${clerkUserId}/sites/temp/`;
   const avatarPrefix = `users/${clerkUserId}/avatar/`;

   if (storageKey.startsWith(catchPrefix)) {
      return 'catch';
   }

   if (storageKey.startsWith(sitePrefix)) {
      return 'site';
   }

   if (storageKey.startsWith(avatarPrefix)) {
      return 'avatar';
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

      const [uploadUrl, readUrl] = await Promise.all([
         buildSignedUploadUrl({
            storageKey,
            contentType: input.contentType,
         }),
         resolveReadUrl(storageKey),
      ]);

      return {
         storageKey,
         uploadUrl,
         readUrl,
      };
   },

   async getReadUrl(storageKey: string) {
      return {
         storageKey,
         readUrl: await resolveReadUrl(storageKey),
      };
   },

   async getDirectUploadData(input: {
      clerkUserId: string;
      scope: UploadScope;
      storageKey: string;
      contentType: SignUploadInput['contentType'];
   }) {
      const expectedPathSegment =
         input.scope === 'avatar'
            ? 'avatar'
            : input.scope === 'catch'
              ? 'catches/temp'
              : 'sites/temp';
      const expectedPrefix = `users/${input.clerkUserId}/${expectedPathSegment}/`;

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
      clerkUserId: string;
      scope: UploadScope;
      storageKey: string;
      contentType: SignUploadInput['contentType'];
      body: Buffer;
   }) {
      const expectedPathSegment =
         input.scope === 'avatar'
            ? 'avatar'
            : input.scope === 'catch'
              ? 'catches/temp'
              : 'sites/temp';
      const expectedPrefix = `users/${input.clerkUserId}/${expectedPathSegment}/`;

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
