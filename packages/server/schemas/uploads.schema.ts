import z from 'zod';

const allowedScopes = ['catch', 'site', 'avatar', 'banner', 'gear'] as const;
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

/* The resized copies the browser makes beside the original. Named rather than
 * keyed, because the key they land on is the server's to decide: see the
 * convention at the top of services/uploads.service.ts. */
const allowedVariants = ['card', 'thumb'] as const;

export const signUploadSchema = z.object({
   scope: z.enum(allowedScopes),
   fileName: z.string().trim().min(1).max(160),
   contentType: z.enum(allowedMimeTypes),
   sizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
   /* Absent from an older client, which then uploads the original alone and
    * reads it at full size, exactly as it did before. */
   variants: z.array(z.enum(allowedVariants)).max(2).optional(),
});

export const getReadUrlSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
});

export const directUploadQuerySchema = z.object({
   scope: z.enum(allowedScopes),
   storageKey: z.string().trim().min(1).max(512),
   contentType: z.enum(allowedMimeTypes),
});

export const proxyUploadQuerySchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
   contentType: z.enum(allowedMimeTypes),
});
