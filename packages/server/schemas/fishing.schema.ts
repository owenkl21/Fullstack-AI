import z from 'zod';

export const fishingRequestSchema = z.object({
   locationName: z.string().trim().min(1).max(50),
});

export const weatherLookupSchema = z.object({
   latitude: z.coerce.number().min(-90).max(90),
   longitude: z.coerce.number().min(-180).max(180),
   /*
    * The moment to read for. A catch logged from the couch that night, or a
    * week later from a photograph, wants the conditions at the hour it was
    * caught, not the hour it was typed in. Absent, it means now.
    */
   at: z.coerce.date().optional(),
});

const optionalTrimmedString = z
   .string()
   .trim()
   .min(1)
   .max(280)
   .optional()
   .nullable();

const imageInputSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
   url: z.string().trim().url(),
});

const weatherSnapshotSchema = z
   .object({
      weatherCondition: z.object({
         /*
          * Not a URL any more. This shape dates from the Google provider,
          * which sent an icon address; Open-Meteo sends none and the client
          * passes an empty string, and demanding a URL here meant every catch
          * saved with its conditions attached was refused with a 400.
          */
         iconBaseUri: z.string().trim().max(512),
         description: z.object({ text: z.string().trim().min(1).max(120) }),
      }),
      temperature: z.object({
         degrees: z.coerce.number(),
         unit: z.string().trim().min(1).max(60),
      }),
      precipitation: z.object({
         probability: z.object({ percent: z.coerce.number().min(0).max(100) }),
      }),
      wind: z.object({
         direction: z.object({ cardinal: z.string().trim().min(1).max(40) }),
         speed: z.object({
            value: z.coerce.number(),
            unit: z.string().trim().min(1).max(60),
         }),
         gust: z.object({
            value: z.coerce.number(),
            unit: z.string().trim().min(1).max(60),
         }),
      }),
      cloudCover: z.coerce.number(),
   })
   .optional()
   .nullable();

const catchPayloadSchema = z.object({
   title: z.string().trim().min(2).max(120),
   notes: z.string().trim().min(1).max(2000).optional().nullable(),
   caughtAt: z.coerce.date(),
   siteId: z.string().trim().min(1).optional().nullable(),
   speciesId: z.string().trim().min(1).optional().nullable(),
   /*
    * Where exactly, when it is not simply "the spot". A saved spot is a place
    * you go back to; a pin is where this one fish came out, which can be a
    * hundred metres along the ledge from it, or nowhere near any saved spot at
    * all when a catch is logged after the fact.
    */
   latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
   longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
   released: z.coerce.boolean().optional(),
   /* Show the fish, withhold the gully it came from. */
   hideLocation: z.coerce.boolean().optional(),
   visibility: z.enum(['PRIVATE', 'GROUPS', 'PUBLIC']).optional(),
   weight: z.coerce.number().positive().optional().nullable(),
   length: z.coerce.number().positive().optional().nullable(),
   count: z.coerce.number().int().positive().max(999).optional(),
   weather: optionalTrimmedString,
   waterTemp: z.coerce.number().optional().nullable(),
   weatherSnapshot: weatherSnapshotSchema,
   depth: z.coerce.number().nonnegative().optional().nullable(),
   gearIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
});

export const createCatchSchema = catchPayloadSchema.extend({
   images: z.array(imageInputSchema).max(8).optional().default([]),
});

export const updateCatchSchema = catchPayloadSchema;

const fishingSitePayloadSchema = z.object({
   name: z.string().trim().min(2).max(120),
   visibility: z.enum(['PRIVATE', 'GROUPS', 'PUBLIC']).optional(),
   description: z.string().trim().min(1).max(2000).optional().nullable(),
   latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
   longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
   waterType: z
      .enum(['FRESHWATER', 'SALTWATER', 'BRACKISH', 'OTHER'])
      .optional()
      .nullable(),
   accessNotes: z.string().trim().min(1).max(500).optional().nullable(),
});

export const createFishingSiteSchema = fishingSitePayloadSchema.extend({
   images: z.array(imageInputSchema).max(12).optional().default([]),
});

export const updateFishingSiteSchema = fishingSitePayloadSchema;

export const speciesSearchSchema = z.object({
   q: z.string().trim().max(120).optional(),
   limit: z.coerce.number().int().positive().max(50).optional().default(20),
});
