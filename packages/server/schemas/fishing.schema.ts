import z from 'zod';

export const fishingRequestSchema = z.object({
   locationName: z.string().trim().min(1).max(50),
});

export const weatherLookupSchema = z.object({
   latitude: z.coerce.number().min(-90).max(90),
   longitude: z.coerce.number().min(-180).max(180),
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
      currentTime: z.string().datetime().optional().nullable(),
      timeZone: z.object({ id: z.string().trim().min(1).max(120) }),
      weatherCondition: z.object({ type: z.string().trim().min(1).max(120) }),
      temperature: z.object({
         degrees: z.coerce.number(),
         unit: z.string().trim().min(1).max(60),
      }),
      feelsLikeTemperature: z.object({
         degrees: z.coerce.number(),
         unit: z.string().trim().min(1).max(60),
      }),
      dewPoint: z.object({
         degrees: z.coerce.number(),
         unit: z.string().trim().min(1).max(60),
      }),
      precipitation: z.object({ probability: z.coerce.number() }),
      airPressure: z.object({ meanSeaLevelMillibars: z.coerce.number() }),
      wind: z.object({
         direction: z.object({ degrees: z.coerce.number() }),
         speed: z.object({
            value: z.coerce.number(),
            unit: z.string().trim().min(1).max(60),
         }),
      }),
      visibility: z.object({
         distance: z.object({
            value: z.coerce.number(),
            unit: z.string().trim().min(1).max(60),
         }),
      }),
      isDaytime: z.boolean(),
      relativeHumidity: z.coerce.number(),
      uvIndex: z.coerce.number(),
      thunderstormProbability: z.coerce.number(),
      cloudCover: z.coerce.number(),
   })
   .optional()
   .nullable();

const catchPayloadSchema = z.object({
   title: z.string().trim().min(2).max(120),
   notes: z.string().trim().min(1).max(2000).optional().nullable(),
   caughtAt: z.coerce.date(),
   siteId: z.string().trim().min(1).optional().nullable(),
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
