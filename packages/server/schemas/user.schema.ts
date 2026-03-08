import z from 'zod';

export const updateProfileSchema = z
   .object({
      displayName: z
         .string()
         .trim()
         .min(2, 'Display name must be at least 2 characters.')
         .max(80, 'Display name must be less than 80 characters.')
         .optional(),
      username: z
         .string()
         .trim()
         .min(3, 'Username must be at least 3 characters.')
         .max(40, 'Username must be less than 40 characters.')
         .regex(
            /^[a-zA-Z0-9_]+$/,
            'Username can only contain letters, numbers, and underscores.'
         )
         .optional(),
      bio: z
         .string()
         .trim()
         .max(280, 'Bio must be 280 characters or less.')
         .nullable()
         .optional(),
      avatarUrl: z
         .string()
         .trim()
         .url('Avatar URL must be a valid URL.')
         .nullable()
         .optional(),
   })
   .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one profile field must be provided.',
      path: ['displayName'],
   });
