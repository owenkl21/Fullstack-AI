import z from 'zod';

const allowedScopes = ['catch', 'site', 'avatar'] as const;
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const signUploadSchema = z.object({
   scope: z.enum(allowedScopes),
   fileName: z.string().trim().min(1).max(160),
   contentType: z.enum(allowedMimeTypes),
   sizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
});

export const getReadUrlSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
});

export const directUploadQuerySchema = z.object({
   scope: z.enum(allowedScopes),
   storageKey: z.string().trim().min(1).max(512),
   contentType: z.enum(allowedMimeTypes),
});
