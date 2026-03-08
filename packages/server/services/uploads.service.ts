import { createHash, createHmac, randomUUID } from 'node:crypto';

type UploadScope = 'catch' | 'site' | 'avatar';

type SignUploadInput = {
   clerkUserId: string;
   scope: UploadScope;
   fileName: string;
   contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

const requiredEnv = [
   'CLOUDFLARE_ACCOUNT_ID',
   'CLOUDFLARE_R2_ACCESS_KEY_ID',
   'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
   'CLOUDFLARE_R2_BUCKET',
] as const;

const getConfig = () => {
   for (const key of requiredEnv) {
      if (!process.env[key]) {
         throw new Error(`Missing required environment variable: ${key}`);
      }
   }

   return {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      publicBaseUrl: process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL,
      region: 'auto',
      service: 's3',
      host: `${process.env.CLOUDFLARE_R2_BUCKET}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
   };
};

const encodeRfc3986 = (value: string) =>
   encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
   );

const sha256Hex = (value: string) =>
   createHash('sha256').update(value, 'utf8').digest('hex');

const hmac = (key: Buffer | string, value: string) =>
   createHmac('sha256', key).update(value, 'utf8').digest();

const getSigningKey = (
   secretAccessKey: string,
   dateStamp: string,
   region: string,
   service: string
) => {
   const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
   const kRegion = hmac(kDate, region);
   const kService = hmac(kRegion, service);
   return hmac(kService, 'aws4_request');
};

const buildPresignedUrl = ({
   method,
   key,
   contentType,
   expiresIn,
}: {
   method: 'GET' | 'PUT';
   key: string;
   contentType?: string;
   expiresIn: number;
}) => {
   const config = getConfig();
   const now = new Date();
   const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
   const amzDate = `${iso.slice(0, 8)}T${iso.slice(9, 15)}Z`;
   const dateStamp = amzDate.slice(0, 8);
   const credentialScope = `${dateStamp}/${config.region}/${config.service}/aws4_request`;
   const canonicalUri = `/${key.split('/').map(encodeRfc3986).join('/')}`;

   const signedHeaders = contentType ? 'content-type;host' : 'host';

   const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': signedHeaders,
   });

   const canonicalQueryString = Array.from(queryParams.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
      .join('&');

   const canonicalHeaders = contentType
      ? `content-type:${contentType}\nhost:${config.host}\n`
      : `host:${config.host}\n`;

   const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
   ].join('\n');

   const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
   ].join('\n');

   const signature = createHmac(
      'sha256',
      getSigningKey(
         config.secretAccessKey,
         dateStamp,
         config.region,
         config.service
      )
   )
      .update(stringToSign, 'utf8')
      .digest('hex');

   queryParams.set('X-Amz-Signature', signature);

   return `https://${config.host}${canonicalUri}?${queryParams.toString()}`;
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
}: SignUploadInput) => {
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

const resolveReadUrl = async (storageKey: string) => {
   const { publicBaseUrl } = getConfig();

   if (publicBaseUrl) {
      const base = publicBaseUrl.replace(/\/+$/, '');
      return `${base}/${storageKey}`;
   }

   return buildPresignedUrl({
      method: 'GET',
      key: storageKey,
      expiresIn: 60 * 10,
   });
};

export const uploadsService = {
   async signUpload(input: SignUploadInput) {
      const storageKey = buildStorageKey(input);

      const uploadUrl = buildPresignedUrl({
         method: 'PUT',
         key: storageKey,
         contentType: input.contentType,
         expiresIn: 60 * 5,
      });

      const readUrl = await resolveReadUrl(storageKey);

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
};
