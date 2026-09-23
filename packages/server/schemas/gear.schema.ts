import z from 'zod';
import { cleanTransform } from '../lib/moderation';

const gearTypes = [
   'ROD',
   'REEL',
   'BAIT',
   'LURE',
   'LINE',
   'HOOK',
   'WEIGHTS',
   'RIG',
] as const;

const imageInputSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
   url: z.string().trim().url(),
});

export const createGearSchema = z.object({
   name: z.string().trim().min(1).max(120).transform(cleanTransform),
   brand: z.string().trim().min(1).max(120),
   type: z.enum(gearTypes),
   image: imageInputSchema.optional().nullable(),
});

export const updateGearSchema = createGearSchema;
