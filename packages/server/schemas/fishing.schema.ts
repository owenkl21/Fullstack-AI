// TODO: implement fishing request/response schemas.
import z from 'zod';

export const fishingRequestSchema = z.object({
   locationName: z.string().trim().min(1).max(50),
});
