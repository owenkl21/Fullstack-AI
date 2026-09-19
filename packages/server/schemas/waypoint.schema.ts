import z from 'zod';

const kind = z.enum(['MARK', 'ACCESS', 'HAZARD', 'PARKING', 'BAIT']);

export const createWaypointSchema = z.object({
   name: z.string().trim().min(1).max(120),
   note: z.string().trim().min(1).max(500).optional().nullable(),
   kind: kind.default('MARK'),
   latitude: z.coerce.number().min(-90).max(90),
   longitude: z.coerce.number().min(-180).max(180),
});

export const updateWaypointSchema = createWaypointSchema.partial();
