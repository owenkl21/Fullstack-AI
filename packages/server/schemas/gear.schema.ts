import z from 'zod';

const gearTypes = [
   'ROD',
   'REEL',
   'BAIT',
   'LURE',
   'LINE',
   'HOOK',
   'WEIGHTS',
] as const;

const imageInputSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
   url: z.string().trim().url(),
});

export const createGearSchema = z.object({
   name: z.string().trim().min(1).max(120),
   brand: z.string().trim().min(1).max(120),
   type: z.enum(gearTypes),
   image: imageInputSchema.optional().nullable(),
});

export const updateGearSchema = createGearSchema;
