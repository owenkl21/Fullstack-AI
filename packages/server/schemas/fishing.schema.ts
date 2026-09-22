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

/*
 * A framing figure is pinned into its range rather than refused. It comes out
 * of pointer arithmetic in the browser, and a catch is not worth losing to a
 * focus of 1.0000001. Anything that is not a number at all is still a 400.
 */
const pinned = (min: number, max: number) =>
   z.coerce
      .number()
      .transform((value) => Math.min(max, Math.max(min, value)))
      .optional()
      .nullable();

/*
 * How a photograph sits in a frame: the point that stays put, as fractions
 * across and down, and how far it is pushed in. Only ever numbers beside the
 * image. The file itself is never cropped, so what the camera wrote in it
 * (the time, the place) is still there to read. Absent or null means the
 * photograph was never framed and the screens use their own default.
 */
const framingFields = {
   focusX: pinned(0, 1),
   focusY: pinned(0, 1),
   zoom: pinned(1, 3),
};

const imageInputSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
   url: z.string().trim().url(),
   ...framingFields,
});

/* Reframing a photograph already on a catch. It names the photo by its key and
   carries the whole framing, so a reset (all three null) clears it. */
const imageFramingSchema = z.object({
   storageKey: z.string().trim().min(1).max(512),
   ...framingFields,
});

/* A figure that may be absent either way: missing, or present and null. */
const maybeNumber = z.number().optional().nullable();

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
         amountMm: maybeNumber,
      }),
      wind: z.object({
         direction: z.object({
            cardinal: z.string().trim().min(1).max(40),
            degrees: maybeNumber,
         }),
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

      /*
       * The rest of a reading, all optional. The block above is what every
       * client has always sent; this is what a client sends when it read
       * Open-Meteo itself because the server could not, so the record still
       * gets the sea, the moon and the pressure. `observedAt` is the hour it
       * read, and is what marks the snapshot as a full reading.
       */
      observedAt: z.string().trim().max(40).optional().nullable(),
      thunder: z.object({ cape: maybeNumber }).optional().nullable(),
      airPressure: z
         .object({ meanSeaLevelMillibars: maybeNumber })
         .optional()
         .nullable(),
      feelsLike: z.object({ degrees: maybeNumber }).optional().nullable(),
      dewPoint: z.object({ degrees: maybeNumber }).optional().nullable(),
      relativeHumidity: maybeNumber,
      visibilityM: maybeNumber,
      uvIndex: maybeNumber,
      isDaytime: z.boolean().optional().nullable(),
      sun: z
         .object({
            rise: z.string().trim().max(40).optional().nullable(),
            set: z.string().trim().max(40).optional().nullable(),
         })
         .optional()
         .nullable(),
      moon: z
         .object({
            fraction: z.number(),
            illumination: z.number(),
            name: z.string().trim().max(40),
            spring: z.boolean(),
         })
         .optional()
         .nullable(),
      sea: z
         .object({
            surfaceTemperatureC: maybeNumber,
            waveHeightM: maybeNumber,
            swellHeightM: maybeNumber,
            swellPeriodS: maybeNumber,
         })
         .optional()
         .nullable(),
   })
   .optional()
   .nullable();

const catchPayloadSchema = z.object({
   title: z.string().trim().min(2).max(120),
   notes: z.string().trim().min(1).max(2000).optional().nullable(),
   caughtAt: z.coerce.date(),
   caughtUntil: z.coerce.date().optional().nullable(),
   lengthSource: z.enum(['EYE', 'TAPE']).optional(),
   /* Logged for a competition, with the figure read off the photograph. */
   competitionId: z.string().trim().min(1).optional().nullable(),
   readMeasure: z.number().optional().nullable(),
   readMeasureUnit: z.enum(['cm', 'in', 'kg', 'lb']).optional().nullable(),
   readConfidence: z.number().min(0).max(1).optional().nullable(),
   readNote: z.string().trim().max(280).optional().nullable(),
   weightSource: z.enum(['LENGTH', 'SCALE', 'EYE']).optional(),
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

export const updateCatchSchema = catchPayloadSchema.extend({
   imageFraming: z.array(imageFramingSchema).max(8).optional(),
});

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

export const createSpeciesSchema = z.object({
   name: z.string().trim().min(2).max(80),
   /* From the fish namer, which speaks in scientific names. */
   scientificName: z.string().trim().min(3).max(120).nullish(),
});
