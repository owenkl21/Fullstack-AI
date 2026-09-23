import { readFileSync } from 'node:fs';
import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
const env = Object.fromEntries(readFileSync(new URL('../packages/server/.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const client = new S3Client({ region: 'auto', endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY } });
const Bucket = env.CLOUDFLARE_R2_BUCKET;
const current = await client.send(new GetBucketCorsCommand({ Bucket }));
console.log('bucket', Bucket, '\ncurrent CORS:', JSON.stringify(current.CORSRules, null, 1));
if (process.argv.includes('--add')) {
   const add = process.argv.slice(process.argv.indexOf('--add') + 1);
   const rules = current.CORSRules.map((r, i) => (i === 0 ? { ...r, AllowedOrigins: [...new Set([...(r.AllowedOrigins || []), ...add])] } : r));
   await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }));
   const after = await client.send(new GetBucketCorsCommand({ Bucket }));
   console.log('after:', JSON.stringify(after.CORSRules[0].AllowedOrigins));
}
