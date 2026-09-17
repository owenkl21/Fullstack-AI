import { prisma } from '../lib/prisma';
import { getCoordinates } from '../clients/geocoding.client';
import {
   getConditionsAt,
   toWeatherSnapshot,
   type Conditions,
} from '../clients/open-meteo.client';
import { uploadsService } from './uploads.service';
import { userService } from './user.service';

type CreateImageInput = {
   storageKey: string;
   url: string;
};

const stripSignedUrlParams = (url: string) => {
   try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
   } catch {
      return url;
   }
};

type WeatherSnapshotInput = {
   weatherCondition: {
      iconBaseUri: string;
      description: { text: string };
   };
   temperature: { degrees: number; unit: string };
   precipitation: { probability: { percent: number } };
   wind: {
      direction: { cardinal: string };
      speed: { value: number; unit: string };
      gust: { value: number; unit: string };
   };
   cloudCover: number;
};

type CreateCatchInput = {
   title: string;
   notes?: string | null;
   caughtAt: Date;
   siteId?: string | null;
   speciesId?: string | null;
   released?: boolean;
   hideLocation?: boolean;
   latitude?: number | null;
   longitude?: number | null;
   visibility?: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   weight?: number | null;
   length?: number | null;
   count?: number;
   weather?: string | null;
   waterTemp?: number | null;
   weatherSnapshot?: WeatherSnapshotInput | null;
   depth?: number | null;
   gearIds: string[];
   images: CreateImageInput[];
};

type CreateFishingSiteInput = {
   name: string;
   visibility?: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   description?: string | null;
   latitude?: number | null;
   longitude?: number | null;
   waterType?: 'FRESHWATER' | 'SALTWATER' | 'BRACKISH' | 'OTHER' | null;
   accessNotes?: string | null;
   images: CreateImageInput[];
};

type UpdateCatchInput = Omit<CreateCatchInput, 'images'>;
type UpdateFishingSiteInput = Omit<CreateFishingSiteInput, 'images'>;

/*
 * Resolves the optional relations, dropping an id that does not exist rather
 * than failing the write. On update, `partial` keeps the difference between a
 * field the client did not send (leave it alone) and one it sent as null
 * (clear it), which is the same distinction the weather columns needed.
 */
const resolveOptionalRelationIds = async (
   input: { siteId?: string | null; speciesId?: string | null },
   { partial = false }: { partial?: boolean } = {}
) => {
   const relations: { siteId?: string | null; speciesId?: string | null } = {};

   if (!partial || input.siteId !== undefined) {
      const site = input.siteId
         ? await prisma.fishingSite.findUnique({
              where: { id: input.siteId },
              select: { id: true },
           })
         : null;

      relations.siteId = site?.id ?? null;
   }

   if (!partial || input.speciesId !== undefined) {
      const species = input.speciesId
         ? await prisma.species.findUnique({
              where: { id: input.speciesId },
              select: { id: true },
           })
         : null;

      relations.speciesId = species?.id ?? null;
   }

   return relations;
};

const catchDetailInclude = {
   createdBy: { select: { id: true, displayName: true, username: true } },
   site: { select: { id: true, name: true, latitude: true, longitude: true } },
   species: { select: { id: true, commonName: true, scientificName: true } },
   gears: {
      select: { id: true, name: true, brand: true, type: true, imageUrl: true },
      orderBy: { createdAt: 'desc' as const },
   },
   images: {
      include: {
         image: { select: { id: true, url: true, storageKey: true } },
      },
      orderBy: { position: 'asc' as const },
   },
};

const siteDetailInclude = {
   createdBy: { select: { id: true, displayName: true, username: true } },
   images: {
      include: {
         image: { select: { id: true, url: true, storageKey: true } },
      },
      orderBy: { position: 'asc' as const },
   },
   catches: {
      orderBy: { caughtAt: 'desc' as const },
      select: {
         id: true,
         title: true,
         caughtAt: true,
         images: {
            take: 1,
            orderBy: { position: 'asc' as const },
            include: {
               image: { select: { id: true, url: true, storageKey: true } },
            },
         },
         species: { select: { commonName: true } },
         createdBy: { select: { displayName: true, username: true } },
      },
   },
};

/*
 * On create, an absent snapshot means every weather column starts null. On
 * update it means the catch was edited without re-reading the weather, so the
 * columns must be left exactly as they are. Prisma treats undefined as "do not
 * touch" and null as "set to null", and the difference between those two is the
 * difference between editing a catch and truncating it.
 */
/*
 * Open-Meteo conditions to the catch's own columns. This is the path that
 * fills the thirteen columns the Google snapshot mapper hard-codes to null.
 *
 * Two are still null and honestly so: Open-Meteo publishes no icon set, and it
 * does not separate thunderstorm probability from the weather code.
 */
const mapConditionsToCatchData = (conditions: Conditions) => ({
   /*
    * Open-Meteo hands back the hour it read as a naive "2026-09-14T04:00",
    * with no seconds and no zone. Prisma wants a full ISO instant, and given
    * the naive string it refused with "premature end of input" and the whole
    * save was a 500. The request is made in UTC, so the string is UTC.
    */
   weatherCurrentTime: conditions.observedAt
      ? new Date(
           /[Zz]|[+-]\d{2}:\d{2}$/.test(conditions.observedAt)
              ? conditions.observedAt
              : `${conditions.observedAt}:00Z`.replace(/:00:00Z$/, ':00Z')
        )
      : null,
   weatherTimeZoneId: conditions.timeZoneId,
   weatherConditionType: conditions.conditionText,
   weatherConditionText: conditions.conditionText,
   weatherConditionIconBaseUri: null,
   weatherTemperatureDegrees: conditions.temperatureC,
   weatherTemperatureUnit: conditions.temperatureC === null ? null : 'CELSIUS',
   weatherFeelsLikeTemperatureDegrees: conditions.feelsLikeC,
   weatherFeelsLikeTemperatureUnit:
      conditions.feelsLikeC === null ? null : 'CELSIUS',
   weatherDewPointDegrees: conditions.dewPointC,
   weatherDewPointUnit: conditions.dewPointC === null ? null : 'CELSIUS',
   weatherPrecipitationProbability: conditions.precipitationProbability,
   weatherAirPressureMeanSeaLevelMillibars: conditions.pressureMsl,
   weatherWindDirectionDegrees: conditions.windDirectionDegrees,
   weatherWindDirectionCardinal: conditions.windDirectionCardinal,
   weatherWindSpeedValue: conditions.windSpeedKph,
   weatherWindSpeedUnit:
      conditions.windSpeedKph === null ? null : 'KILOMETERS_PER_HOUR',
   weatherWindGustValue: conditions.windGustKph,
   weatherWindGustUnit:
      conditions.windGustKph === null ? null : 'KILOMETERS_PER_HOUR',
   weatherVisibilityDistanceValue: conditions.visibilityM,
   weatherVisibilityDistanceUnit:
      conditions.visibilityM === null ? null : 'METERS',
   weatherIsDaytime: conditions.isDaytime,
   weatherRelativeHumidity: conditions.relativeHumidity,
   weatherUvIndex: conditions.uvIndex,
   weatherThunderstormProbability: null,
   weatherCloudCover: conditions.cloudCover,

   /*
    * The sea, the light and the moon. Fetched and shown for a while before
    * this and then dropped on save, so a catch could report the air pressure
    * at the time and not the water temperature, which is the first thing a
    * shore angler would ask about.
    */
   weatherSeaSurfaceTemperatureC: conditions.seaSurfaceTemperatureC,
   weatherWaveHeightM: conditions.waveHeightM,
   weatherSwellHeightM: conditions.swellHeightM,
   weatherSwellPeriodS: conditions.swellPeriodS,
   weatherSunrise: conditions.sunrise ? new Date(conditions.sunrise) : null,
   weatherSunset: conditions.sunset ? new Date(conditions.sunset) : null,
   weatherMoonPhase: conditions.moon?.name ?? null,
   weatherMoonIllumination: conditions.moon?.illumination ?? null,
   weatherMoonSpringTide: conditions.moon?.spring ?? null,
});

const mapWeatherSnapshotToCatchData = (
   weatherSnapshot?: WeatherSnapshotInput | null,
   { partial = false }: { partial?: boolean } = {}
) => {
   if (!weatherSnapshot) {
      if (partial) {
         return {};
      }

      return {
         weatherCurrentTime: null,
         weatherTimeZoneId: null,
         weatherConditionType: null,
         weatherConditionText: null,
         weatherConditionIconBaseUri: null,
         weatherTemperatureDegrees: null,
         weatherTemperatureUnit: null,
         weatherFeelsLikeTemperatureDegrees: null,
         weatherFeelsLikeTemperatureUnit: null,
         weatherDewPointDegrees: null,
         weatherDewPointUnit: null,
         weatherPrecipitationProbability: null,
         weatherAirPressureMeanSeaLevelMillibars: null,
         weatherWindDirectionDegrees: null,
         weatherWindDirectionCardinal: null,
         weatherWindSpeedValue: null,
         weatherWindSpeedUnit: null,
         weatherWindGustValue: null,
         weatherWindGustUnit: null,
         weatherVisibilityDistanceValue: null,
         weatherVisibilityDistanceUnit: null,
         weatherIsDaytime: null,
         weatherRelativeHumidity: null,
         weatherUvIndex: null,
         weatherThunderstormProbability: null,
         weatherCloudCover: null,
      };
   }

   return {
      weatherCurrentTime: null,
      weatherTimeZoneId: null,
      weatherConditionType: weatherSnapshot.weatherCondition.description.text,
      weatherConditionText: weatherSnapshot.weatherCondition.description.text,
      weatherConditionIconBaseUri: weatherSnapshot.weatherCondition.iconBaseUri,
      weatherTemperatureDegrees: weatherSnapshot.temperature.degrees,
      weatherTemperatureUnit: weatherSnapshot.temperature.unit,
      weatherFeelsLikeTemperatureDegrees: null,
      weatherFeelsLikeTemperatureUnit: null,
      weatherDewPointDegrees: null,
      weatherDewPointUnit: null,
      weatherPrecipitationProbability: Math.round(
         weatherSnapshot.precipitation.probability.percent
      ),
      weatherAirPressureMeanSeaLevelMillibars: null,
      weatherWindDirectionDegrees: null,
      weatherWindDirectionCardinal: weatherSnapshot.wind.direction.cardinal,
      weatherWindSpeedValue: weatherSnapshot.wind.speed.value,
      weatherWindSpeedUnit: weatherSnapshot.wind.speed.unit,
      weatherWindGustValue: weatherSnapshot.wind.gust.value,
      weatherWindGustUnit: weatherSnapshot.wind.gust.unit,
      weatherVisibilityDistanceValue: null,
      weatherVisibilityDistanceUnit: null,
      weatherIsDaytime: null,
      weatherRelativeHumidity: null,
      weatherUvIndex: null,
      weatherThunderstormProbability: null,
      weatherCloudCover: Math.round(weatherSnapshot.cloudCover),
   };
};

const buildPlaceholderIdentity = (userId: string) => {
   const normalized = userId.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
   const username = `clerk_${normalized}`;

   return {
      email: `${username}@placeholder.local`,
      username,
      displayName: 'New Angler',
   };
};

/*
 * The id on the request is this app's own User.id now, so this is an existence
 * check rather than the lookup-and-sync-from-Clerk it used to be.
 */
async function getUserById(userId: string) {
   return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true },
   });
}

const withResolvedGearImageUrls = async <
   T extends {
      gears: Array<{ imageUrl: string | null }>;
   },
>(
   record: T
): Promise<T> => {
   const imageUrls = record.gears
      .map((gear) => gear.imageUrl)
      .filter((url): url is string => Boolean(url));

   if (imageUrls.length === 0) {
      return record;
   }

   const normalizedImageUrls = Array.from(
      new Set(imageUrls.map((url) => stripSignedUrlParams(url)))
   );

   const images: Array<{ url: string; storageKey: string }> =
      await prisma.image.findMany({
         where: { url: { in: normalizedImageUrls } },
         select: { url: true, storageKey: true },
      });

   const storageKeyByUrl = new Map<string, string>(
      images.map((image: { url: string; storageKey: string }) => [
         image.url,
         image.storageKey,
      ])
   );

   const gears = await Promise.all(
      record.gears.map(async (gear) => {
         if (!gear.imageUrl) {
            return gear;
         }

         const normalizedUrl = stripSignedUrlParams(gear.imageUrl);
         const storageKey = storageKeyByUrl.get(normalizedUrl);
         if (!storageKey) {
            return gear;
         }

         try {
            const signed = await uploadsService.getReadUrl(storageKey);
            return { ...gear, imageUrl: signed.readUrl };
         } catch (error) {
            console.warn(
               '[fishing:gear] Falling back to persisted gear image URL because generating read URL failed.',
               {
                  storageKey,
                  error,
               }
            );

            return gear;
         }
      })
   );

   return {
      ...record,
      gears,
   };
};
const withResolvedImageUrls = async <
   T extends {
      images: Array<{
         image: { id: string; storageKey: string; url: string };
      }>;
   },
>(
   record: T
): Promise<T> => {
   const images = await Promise.all(
      record.images.map(async (entry) => {
         try {
            const signed = await uploadsService.getReadUrl(
               entry.image.storageKey
            );

            return {
               ...entry,
               image: {
                  ...entry.image,
                  url: signed.readUrl,
               },
            };
         } catch (error) {
            console.warn(
               '[fishing:create] Falling back to persisted image URL because generating read URL failed.',
               {
                  storageKey: entry.image.storageKey,
                  error,
               }
            );

            return entry;
         }
      })
   );

   return {
      ...record,
      images,
   };
};

export const fishingService = {
   /**
    * Spots anyone may see, for the map.
    *
    * This used to select every spot in the table regardless of visibility, so a
    * mark somebody had deliberately kept private was handed to anyone who asked
    * for the list. The filter is the point of the endpoint now, not a detail of
    * it.
    *
    * It carries what makes a map worth reading: how many fish have come out of
    * each spot, and which species, so the map can be filtered by the fish you
    * are actually after.
    */
   async listFishingSites() {
      const sites = await prisma.fishingSite.findMany({
         where: { deletedAt: null, visibility: 'PUBLIC' },
         orderBy: { name: 'asc' },
         take: 500,
         select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            waterType: true,
            createdById: true,
            createdBy: { select: { displayName: true } },
            catches: {
               where: { deletedAt: null, visibility: 'PUBLIC' },
               select: {
                  speciesId: true,
                  species: { select: { commonName: true } },
               },
            },
         },
      });

      return sites.map((site) => {
         /* Which fish this spot is known for, most caught first. */
         const counts = new Map<string, { name: string; count: number }>();
         for (const entry of site.catches) {
            if (!entry.speciesId || !entry.species) continue;
            const seen = counts.get(entry.speciesId);
            if (seen) seen.count += 1;
            else
               counts.set(entry.speciesId, {
                  name: entry.species.commonName,
                  count: 1,
               });
         }

         const species = [...counts.entries()]
            .map(([id, v]) => ({ id, name: v.name, count: v.count }))
            .sort((a, b) => b.count - a.count);

         return {
            id: site.id,
            name: site.name,
            latitude: site.latitude,
            longitude: site.longitude,
            waterType: site.waterType,
            createdById: site.createdById,
            createdByName: site.createdBy?.displayName ?? null,
            catchCount: site.catches.length,
            species,
         };
      });
   },

   async getFishingConditions(locationName: string) {
      const coordinates = await getCoordinates(locationName);
      const conditions = await getConditionsAt(
         coordinates.latitude,
         coordinates.longitude,
         new Date()
      );

      return {
         location: coordinates,
         weather: toWeatherSnapshot(conditions),
      };
   },

   /*
    * The conditions at a place, at a moment. "Current" stays in the name for
    * the route that already calls it; with `at` it is the hour a fish was
    * caught, which the Open-Meteo client can read back for weeks.
    */
   async getCurrentWeatherByCoordinates(
      latitude: number,
      longitude: number,
      at?: Date
   ) {
      const conditions = await getConditionsAt(
         latitude,
         longitude,
         at ?? new Date()
      );
      return toWeatherSnapshot(conditions);
   },

   async createCatch(userId: string, input: CreateCatchInput) {
      const user = await getUserById(userId);
      const relations = await resolveOptionalRelationIds({
         siteId: input.siteId,
         speciesId: input.speciesId,
      });

      const validGears = input.gearIds.length
         ? await prisma.gear.findMany({
              where: { id: { in: input.gearIds } },
              select: { id: true },
           })
         : [];

      /*
       * Read the conditions for the hour the fish was caught, at the spot it
       * was caught, rather than trusting whatever the client happened to see
       * when the sheet opened. A catch logged from the car park at 21:00 was
       * caught at 18:40, and 18:40 is what the record should carry.
       *
       * Falls back to the client's snapshot when there is no spot to read a
       * position from. Never throws: a catch is worth more than its weather.
       */
      const site = relations.siteId
         ? await prisma.fishingSite.findUnique({
              where: { id: relations.siteId },
              select: { latitude: true, longitude: true },
           })
         : null;

      /*
       * The conditions are read here, on the server, for the hour the fish
       * was caught and for wherever it was caught: the catch's own pin first,
       * the spot's position otherwise. That is what makes the full reading
       * land in the record, sea and moon included. The client's snapshot is
       * only a fallback for a catch with no position at all, and it carries
       * a fraction of the fields.
       */
      const at = new Date(input.caughtAt);
      const where =
         typeof input.latitude === 'number' &&
         typeof input.longitude === 'number'
            ? { latitude: input.latitude, longitude: input.longitude }
            : site &&
                typeof site.latitude === 'number' &&
                typeof site.longitude === 'number'
              ? { latitude: site.latitude, longitude: site.longitude }
              : null;

      const read = where
         ? await getConditionsAt(where.latitude, where.longitude, at).catch(
              (error: unknown) => {
                 console.warn('[catch:create] conditions lookup threw', error);
                 return null;
              }
           )
         : null;

      /*
       * An empty reading is not a reading. The client fetched a reading for
       * the same place and hour, so if the lookup came back with nothing that
       * one is kept rather than a row of nulls.
       */
      const conditions = read && read.observedAt ? read : null;
      if (where && !conditions) {
         console.warn(
            '[catch:create] no conditions for',
            where,
            at.toISOString()
         );
      }

      const created = await prisma.$transaction(async (tx) => {
         const catchRecord = await tx.catch.create({
            data: {
               createdById: user.id,
               ...relations,
               title: input.title,
               notes: input.notes,
               caughtAt: input.caughtAt,
               weight: input.weight,
               length: input.length,
               count: input.count ?? 1,
               released: input.released ?? false,
               hideLocation: input.hideLocation ?? false,
               latitude: input.latitude ?? null,
               longitude: input.longitude ?? null,
               visibility: input.visibility ?? 'PUBLIC',
               weather: input.weather,
               waterTemp:
                  input.waterTemp ?? conditions?.seaSurfaceTemperatureC ?? null,
               ...(conditions
                  ? mapConditionsToCatchData(conditions)
                  : mapWeatherSnapshotToCatchData(input.weatherSnapshot)),
               depth: input.depth,
               gears: {
                  connect: validGears.map((gear) => ({ id: gear.id })),
               },
            },
         });

         if (relations.siteId) {
            await tx.fishingSite.update({
               where: { id: relations.siteId },
               data: { catchCount: { increment: 1 } },
            });
         }

         for (const [position, image] of input.images.entries()) {
            try {
               const normalizedUrl = stripSignedUrlParams(image.url);
               const createdImage = await tx.image.upsert({
                  where: { storageKey: image.storageKey },
                  create: {
                     uploadedById: user.id,
                     storageKey: image.storageKey,
                     url: normalizedUrl,
                  },
                  update: {
                     url: normalizedUrl,
                  },
               });

               await tx.catchImage.upsert({
                  where: {
                     catchId_imageId: {
                        catchId: catchRecord.id,
                        imageId: createdImage.id,
                     },
                  },
                  create: {
                     catchId: catchRecord.id,
                     imageId: createdImage.id,
                     position,
                  },
                  update: {
                     position,
                  },
               });
            } catch (error) {
               console.warn(
                  '[fishing:create] Failed to persist one catch image; continuing without it.',
                  {
                     catchId: catchRecord.id,
                     storageKey: image.storageKey,
                     error,
                  }
               );
            }
         }

         /*
          * A private catch publishes nothing. This is the whole point of the
          * visibility switch: it has to be checked here, on the way in, not
          * filtered out of the feed afterwards, because a post that exists can
          * be read by something that forgets to filter.
          */
         if ((input.visibility ?? 'PUBLIC') !== 'PRIVATE') {
            /*
             * The post carries a position, so Near me can find a catch and not
             * only a spot. The pin wins, the spot's position is the fallback,
             * and neither travels when the angler asked to keep the mark to
             * themselves: the catch still has it, the post does not.
             */
            const site = relations.siteId
               ? await tx.fishingSite.findUnique({
                    where: { id: relations.siteId },
                    select: { latitude: true, longitude: true },
                 })
               : null;
            const withhold = input.hideLocation ?? false;
            const latitude = withhold
               ? null
               : (input.latitude ?? site?.latitude ?? null);
            const longitude = withhold
               ? null
               : (input.longitude ?? site?.longitude ?? null);

            await tx.feedPost.create({
               data: {
                  authorId: user.id,
                  type: 'CATCH',
                  scope: 'GLOBAL',
                  visibility: input.visibility ?? 'PUBLIC',
                  content: input.notes || null,
                  catchId: catchRecord.id,
                  siteId: withhold ? null : (relations.siteId ?? null),
                  latitude,
                  longitude,
               },
            });
         }

         return tx.catch.findUniqueOrThrow({
            where: { id: catchRecord.id },
            include: catchDetailInclude,
         });
      });

      const withResolvedImages = await withResolvedImageUrls(created);
      return withResolvedGearImageUrls(withResolvedImages);
   },

   async getCatchById(catchId: string) {
      const catchRecord = await prisma.catch.findFirst({
         where: { id: catchId, deletedAt: null },
         include: catchDetailInclude,
      });

      if (!catchRecord) {
         return null;
      }

      const withResolvedImages = await withResolvedImageUrls(catchRecord);
      return withResolvedGearImageUrls(withResolvedImages);
   },

   async listMyCatches(userId: string) {
      const user = await getUserById(userId);

      const catches = await prisma.catch.findMany({
         where: { createdById: user.id, deletedAt: null },
         orderBy: { caughtAt: 'desc' },
         select: {
            id: true,
            title: true,
            caughtAt: true,
            count: true,
            length: true,
            weight: true,
            site: { select: { id: true, name: true } },
            /* The fast log offers the species this angler actually logs, so the
             * list has to carry them. */
            species: { select: { id: true, commonName: true } },
            images: {
               take: 1,
               orderBy: { position: 'asc' },
               include: {
                  image: { select: { id: true, url: true, storageKey: true } },
               },
            },
         },
      });

      return Promise.all(catches.map((entry) => withResolvedImageUrls(entry)));
   },

   async updateCatch(userId: string, catchId: string, input: UpdateCatchInput) {
      const user = await getUserById(userId);
      const relations = await resolveOptionalRelationIds(
         {
            siteId: input.siteId,
            speciesId: input.speciesId,
         },
         { partial: true }
      );

      const validGears = input.gearIds.length
         ? await prisma.gear.findMany({
              where: { id: { in: input.gearIds } },
              select: { id: true },
           })
         : [];

      return prisma.$transaction(async (tx) => {
         const existing = await tx.catch.findFirst({
            where: { id: catchId, createdById: user.id, deletedAt: null },
            select: { id: true, siteId: true },
         });

         if (!existing) {
            return null;
         }

         if (existing.siteId && existing.siteId !== relations.siteId) {
            await tx.fishingSite.update({
               where: { id: existing.siteId },
               data: { catchCount: { decrement: 1 } },
            });
         }

         if (relations.siteId && existing.siteId !== relations.siteId) {
            await tx.fishingSite.update({
               where: { id: relations.siteId },
               data: { catchCount: { increment: 1 } },
            });
         }

         const updated = await tx.catch.update({
            where: { id: catchId },
            data: {
               title: input.title,
               notes: input.notes,
               caughtAt: input.caughtAt,
               ...relations,
               weight: input.weight,
               length: input.length,
               count: input.count,
               released: input.released,
               hideLocation: input.hideLocation,
               latitude: input.latitude,
               longitude: input.longitude,
               visibility: input.visibility,
               weather: input.weather,
               waterTemp: input.waterTemp,
               ...mapWeatherSnapshotToCatchData(input.weatherSnapshot, {
                  partial: true,
               }),
               depth: input.depth,
               gears: {
                  set: validGears.map((gear) => ({ id: gear.id })),
               },
            },
            include: catchDetailInclude,
         });

         const withResolvedImages = await withResolvedImageUrls(updated);
         return withResolvedGearImageUrls(withResolvedImages);
      });
   },

   async deleteCatch(userId: string, catchId: string) {
      const user = await getUserById(userId);

      return prisma.$transaction(async (tx) => {
         const existing = await tx.catch.findFirst({
            where: { id: catchId, createdById: user.id, deletedAt: null },
            select: { id: true, siteId: true },
         });

         if (!existing) {
            return null;
         }

         const deletedAt = new Date();

         await tx.catch.update({
            where: { id: catchId },
            data: { deletedAt },
         });

         /*
          * Feed rows are snapshots rather than pointers, so a post outlives the
          * catch it was written from and keeps showing its title and photo.
          * Retire the posts with the catch.
          */
         await tx.feedPost.updateMany({
            where: { catchId, deletedAt: null },
            data: { deletedAt },
         });

         if (existing.siteId) {
            await tx.fishingSite.update({
               where: { id: existing.siteId },
               data: { catchCount: { decrement: 1 } },
            });
         }

         return { id: catchId };
      });
   },

   async createFishingSite(userId: string, input: CreateFishingSiteInput) {
      const user = await getUserById(userId);

      const created = await prisma.$transaction(async (tx) => {
         const site = await tx.fishingSite.create({
            data: {
               createdById: user.id,
               name: input.name,
               description: input.description,
               latitude: input.latitude,
               longitude: input.longitude,
               waterType: input.waterType,
               visibility: input.visibility ?? 'PUBLIC',
               accessNotes: input.accessNotes,
            },
         });

         for (const [position, image] of input.images.entries()) {
            const createdImage = await tx.image.create({
               data: {
                  uploadedById: user.id,
                  storageKey: image.storageKey,
                  url: stripSignedUrlParams(image.url),
               },
            });

            await tx.siteImage.create({
               data: {
                  siteId: site.id,
                  imageId: createdImage.id,
                  position,
               },
            });
         }

         /*
          * Same rule, and it matters more here: a spot post carries exact
          * coordinates. A private spot never leaves the angler's own log.
          */
         if ((input.visibility ?? 'PUBLIC') !== 'PRIVATE') {
            await tx.feedPost.create({
               data: {
                  authorId: user.id,
                  type: 'SITE',
                  scope: 'GLOBAL',
                  visibility: input.visibility ?? 'PUBLIC',
                  content: input.description || null,
                  siteId: site.id,
                  latitude: input.latitude,
                  longitude: input.longitude,
               },
            });
         }

         return tx.fishingSite.findUniqueOrThrow({
            where: { id: site.id },
            include: siteDetailInclude,
         });
      });

      return withResolvedImageUrls(created);
   },

   async getFishingSiteById(siteId: string) {
      const site = await prisma.fishingSite.findFirst({
         where: { id: siteId, deletedAt: null },
         include: siteDetailInclude,
      });

      if (!site) {
         return null;
      }

      const siteWithResolvedImages = await withResolvedImageUrls(site);
      const catchesWithResolvedImages = await Promise.all(
         siteWithResolvedImages.catches.map((entry) =>
            withResolvedImageUrls(entry)
         )
      );

      return {
         ...siteWithResolvedImages,
         catches: catchesWithResolvedImages,
      };
   },

   async listMyFishingSites(userId: string) {
      const user = await getUserById(userId);

      const sites = await prisma.fishingSite.findMany({
         where: { createdById: user.id, deletedAt: null },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            name: true,
            createdAt: true,
            catchCount: true,
            // The angler's own spots, so the exact pin is theirs to see. The
            // coarsening rule in appendix E is about publishing someone else's.
            latitude: true,
            longitude: true,
            images: {
               take: 1,
               orderBy: { position: 'asc' },
               include: {
                  image: { select: { id: true, url: true, storageKey: true } },
               },
            },
         },
      });

      return Promise.all(sites.map((entry) => withResolvedImageUrls(entry)));
   },

   async updateFishingSite(
      userId: string,
      siteId: string,
      input: UpdateFishingSiteInput
   ) {
      const user = await getUserById(userId);
      const existing = await prisma.fishingSite.findFirst({
         where: { id: siteId, createdById: user.id, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      const updated = await prisma.fishingSite.update({
         where: { id: siteId },
         data: {
            name: input.name,
            description: input.description,
            latitude: input.latitude,
            longitude: input.longitude,
            waterType: input.waterType,
            accessNotes: input.accessNotes,
         },
         include: siteDetailInclude,
      });

      return withResolvedImageUrls(updated);
   },

   /*
    * Species search for the log form. Matches the common name, the scientific
    * name and the aliases, because a South African angler types "leervis" or
    * "garrick" for the same fish and neither is wrong.
    */
   async searchSpecies(query: string | undefined, limit: number) {
      const q = query?.trim();

      const species = await prisma.species.findMany({
         where: q
            ? {
                 OR: [
                    { commonName: { contains: q } },
                    { scientificName: { contains: q } },
                 ],
              }
            : undefined,
         orderBy: { commonName: 'asc' },
         /* With no query this is the picker's whole list, so do not page it. */
         take: q ? limit : 200,
         select: {
            id: true,
            commonName: true,
            scientificName: true,
            aliases: true,
         },
      });

      if (!q) {
         return species;
      }

      /*
       * Aliases are JSON, which MySQL cannot index or match with `contains`,
       * so they are filtered here. The name match above already narrowed the
       * set, so this runs over a short list rather than the whole table.
       */
      const lowered = q.toLowerCase();
      const byAlias = await prisma.species.findMany({
         orderBy: { commonName: 'asc' },
         select: {
            id: true,
            commonName: true,
            scientificName: true,
            aliases: true,
         },
      });

      const seen = new Set(species.map((entry) => entry.id));
      const extra = byAlias.filter((entry) => {
         if (seen.has(entry.id)) {
            return false;
         }

         return (
            Array.isArray(entry.aliases) &&
            entry.aliases.some(
               (alias) =>
                  typeof alias === 'string' &&
                  alias.toLowerCase().includes(lowered)
            )
         );
      });

      return [...species, ...extra].slice(0, limit);
   },

   async deleteFishingSite(userId: string, siteId: string) {
      const user = await getUserById(userId);
      const existing = await prisma.fishingSite.findFirst({
         where: { id: siteId, createdById: user.id, deletedAt: null },
         select: { id: true },
      });

      if (!existing) {
         return null;
      }

      const deletedAt = new Date();

      /*
       * One transaction, so a site never ends up retired while its posts stay
       * up. Same reason as deleteCatch: feed rows are snapshots, not pointers.
       */
      await prisma.$transaction(async (tx) => {
         await tx.fishingSite.update({
            where: { id: siteId },
            data: { deletedAt },
         });

         await tx.feedPost.updateMany({
            where: { siteId, deletedAt: null },
            data: { deletedAt },
         });
      });

      return { id: siteId };
   },
};
