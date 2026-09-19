import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { namePlace } from '../clients/geocoding.client';
import { uploadsService } from './uploads.service';
import { visionService } from './vision.service';

/*
 * A catch entered in a competition.
 *
 * An entry is the catch frozen at the moment it was entered: the species, the
 * figure, the photographs, the time and the place. Editing the catch later
 * does not move a result, and deleting it excludes the entry. Every entry is
 * checked, six lines: a fish in the photo, the species, the figure read off
 * the tape or scale, the window, the area, and whether the same fish has been
 * entered before. Pass on all and it counts; any flag holds it for the
 * organiser. A check that could not run is written down as not checked, and
 * for the two that matter most (species and figure) that holds the entry too,
 * so nothing goes on a board unseen.
 */

export type CheckCode =
   | 'fish'
   | 'species'
   | 'figure'
   | 'window'
   | 'area'
   | 'duplicate';
export type ReportLine = {
   code: CheckCode;
   status: 'pass' | 'flag' | 'skip';
   detail: string;
};
export type EntryState = 'PENDING' | 'COUNTED' | 'HELD' | 'EXCLUDED';

const SURE_ENOUGH = 0.6;
const NAMER_SURE = 0.5;
const SAME_FISH = 0.93;
const GRACE_MS = 60 * 60 * 1000;
const LATE_MS = 24 * 60 * 60 * 1000;

export const ENTRY_SELECT = {
   id: true,
   competitionId: true,
   catchId: true,
   userId: true,
   user: { select: { displayName: true, username: true } },
   state: true,
   measure: true,
   speciesId: true,
   speciesName: true,
   declaredValue: true,
   readValue: true,
   readConfidence: true,
   readNote: true,
   value: true,
   caughtAt: true,
   latitude: true,
   longitude: true,
   areaConfirmed: true,
   photoTakenAt: true,
   heroImageKey: true,
   heroImageUrl: true,
   measureImageKey: true,
   measureImageUrl: true,
   note: true,
   fingerprint: true,
   report: true,
   flags: true,
   flaggedById: true,
   flagReason: true,
   flaggedAt: true,
   reviewedById: true,
   reviewedAt: true,
   reviewNote: true,
   createdAt: true,
} as const;

export type EntryRow = Prisma.CompetitionEntryGetPayload<{
   select: typeof ENTRY_SELECT;
}>;

type CompetitionForEntries = {
   id: string;
   createdById: string;
   rule: 'SPECIES_POINTS' | 'BIGGEST_FISH' | 'SPECIES_VARIETY';
   measure: 'LENGTH' | 'WEIGHT';
   checks: 'CASUAL' | 'REVIEW';
   speciesId: string | null;
   species: { id: string; commonName: string } | null;
   startsAt: Date;
   endsAt: Date;
   timeZoneId: string;
   maxPerSpeciesPerDay: number;
   areaType: 'ANYWHERE' | 'WATERBODY' | 'REGION';
   areaName: string | null;
   areaLatitude: number | null;
   areaLongitude: number | null;
   areaRadiusKm: number | null;
};

const COMPETITION_FOR_ENTRIES = {
   id: true,
   createdById: true,
   rule: true,
   measure: true,
   checks: true,
   speciesId: true,
   species: { select: { id: true, commonName: true } },
   startsAt: true,
   endsAt: true,
   timeZoneId: true,
   maxPerSpeciesPerDay: true,
   areaType: true,
   areaName: true,
   areaLatitude: true,
   areaLongitude: true,
   areaRadiusKm: true,
} as const;

export type SubmitEntryInput = {
   catchId: string;
   measureImage: { storageKey: string; url: string } | null;
   declaredValue: number | null;
   areaConfirmed: boolean;
   photoTakenAt: Date | null;
   note: string | null;
};

export type SubmitFailure =
   | 'not_found'
   | 'not_entered'
   | 'not_open'
   | 'closed'
   | 'catch_not_found'
   | 'already_entered'
   | 'measure_photo_required';

const norm = (text: string) =>
   text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

const stripSigned = (url: string) => {
   try {
      const u = new URL(url);
      u.search = '';
      return u.toString();
   } catch {
      return url;
   }
};

const km = (a: [number, number], b: [number, number]) => {
   const R = 6371;
   const dLat = ((b[0] - a[0]) * Math.PI) / 180;
   const dLng = ((b[1] - a[1]) * Math.PI) / 180;
   const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a[0] * Math.PI) / 180) *
         Math.cos((b[0] * Math.PI) / 180) *
         Math.sin(dLng / 2) ** 2;
   return 2 * R * Math.asin(Math.sqrt(s));
};

const cosine = (a: number[], b: number[]) => {
   let dot = 0;
   let na = 0;
   let nb = 0;
   const n = Math.min(a.length, b.length);
   for (let i = 0; i < n; i++) {
      dot += a[i]! * b[i]!;
      na += a[i]! * a[i]!;
      nb += b[i]! * b[i]!;
   }
   return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const toMetric = (value: number, unit: 'cm' | 'in' | 'kg' | 'lb'): number =>
   unit === 'in' ? value * 2.54 : unit === 'lb' ? value * 0.45359237 : value;

const unitOf = (measure: 'LENGTH' | 'WEIGHT') =>
   measure === 'LENGTH' ? 'cm' : 'kg';

const fmt = (value: number, measure: 'LENGTH' | 'WEIGHT') =>
   measure === 'LENGTH'
      ? `${Math.round(value * 10) / 10} cm`
      : `${Math.round(value * 100) / 100} kg`;

/** The local calendar day, in the competition's own time zone. */
const localDay = (at: Date, timeZone: string) => {
   try {
      return new Intl.DateTimeFormat('en-CA', {
         timeZone,
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
      }).format(at);
   } catch {
      return at.toISOString().slice(0, 10);
   }
};

const readUrl = async (
   key: string | null,
   url: string | null,
   variant: 'full' | 'card' = 'full'
) => {
   if (!key) return url;
   try {
      const urls = await uploadsService.getReadUrl(key);
      return variant === 'card' ? urls.cardReadUrl : urls.readUrl;
   } catch {
      return url;
   }
};

export type ShapedEntry = {
   id: string;
   anglerId: string;
   displayName: string;
   username: string | null;
   speciesName: string | null;
   value: number | null;
   declaredValue: number | null;
   readValue: number | null;
   readConfidence: number | null;
   state: EntryState;
   flags: string[];
   report: ReportLine[];
   caughtAt: string;
   note: string | null;
   heroUrl: string | null;
   measureUrl: string | null;
   areaConfirmed: boolean;
   flaggedBy: string | null;
   flagReason: string | null;
   reviewNote: string | null;
   yours: boolean;
   canReview: boolean;
   canFlag: boolean;
   createdAt: string;
};

export type Standing = {
   place: number;
   joint: boolean;
   anglerId: string;
   displayName: string;
   username: string | null;
   score: number;
   bestValue: number | null;
   bestSpeciesName: string | null;
   entries: number;
   distinctSpecies: number;
};

export const entriesService = {
   async competitionFor(competitionId: string) {
      return prisma.competition.findFirst({
         where: { id: competitionId, deletedAt: null },
         select: COMPETITION_FOR_ENTRIES,
      });
   },

   async isIn(competitionId: string, userId: string) {
      const entrant = await prisma.competitionEntrant.findFirst({
         where: { competitionId, userId, leftAt: null },
         select: { id: true },
      });
      return entrant !== null;
   },

   /**
    * Enter a catch. The entry is written straight away in PENDING and the
    * checks run after the response; the client polls the entry.
    */
   async submit(
      userId: string,
      competitionId: string,
      input: SubmitEntryInput
   ): Promise<{ entry: EntryRow } | { error: SubmitFailure }> {
      const competition = await this.competitionFor(competitionId);
      if (!competition) return { error: 'not_found' };
      const inIt =
         competition.createdById === userId ||
         (await this.isIn(competitionId, userId));
      if (!inIt) return { error: 'not_entered' };
      const now = Date.now();
      if (now < competition.startsAt.getTime()) return { error: 'not_open' };
      if (now > competition.endsAt.getTime() + LATE_MS) {
         return { error: 'closed' };
      }
      if (competition.rule !== 'SPECIES_VARIETY' && !input.measureImage) {
         return { error: 'measure_photo_required' };
      }

      const record = await prisma.catch.findFirst({
         where: { id: input.catchId, createdById: userId, deletedAt: null },
         select: {
            id: true,
            caughtAt: true,
            latitude: true,
            longitude: true,
            length: true,
            weight: true,
            speciesId: true,
            species: { select: { commonName: true } },
            site: { select: { latitude: true, longitude: true } },
            images: {
               orderBy: { position: 'asc' },
               take: 1,
               select: { image: { select: { storageKey: true, url: true } } },
            },
         },
      });
      if (!record) return { error: 'catch_not_found' };

      const existing = await prisma.competitionEntry.findUnique({
         where: {
            competitionId_catchId: { competitionId, catchId: record.id },
         },
         select: { id: true },
      });
      if (existing) return { error: 'already_entered' };

      const hero = record.images[0]?.image ?? null;
      const declared =
         input.declaredValue ??
         (competition.measure === 'LENGTH' ? record.length : record.weight) ??
         null;
      const latitude = record.latitude ?? record.site?.latitude ?? null;
      const longitude = record.longitude ?? record.site?.longitude ?? null;

      const entry = await prisma.competitionEntry.create({
         data: {
            competitionId,
            catchId: record.id,
            userId,
            state: 'PENDING',
            measure: competition.measure,
            speciesId: record.speciesId,
            speciesName: record.species?.commonName ?? null,
            declaredValue: declared,
            value: declared,
            caughtAt: record.caughtAt,
            latitude,
            longitude,
            areaConfirmed: input.areaConfirmed,
            photoTakenAt: input.photoTakenAt,
            heroImageKey: hero?.storageKey ?? null,
            heroImageUrl: hero ? stripSigned(hero.url) : null,
            measureImageKey: input.measureImage?.storageKey ?? null,
            measureImageUrl: input.measureImage
               ? stripSigned(input.measureImage.url)
               : null,
            note: input.note,
         },
         select: ENTRY_SELECT,
      });

      void this.verify(entry.id).catch((error) =>
         console.warn('[entry:verify] failed', entry.id, String(error))
      );
      return { entry };
   },

   /** The six checks. Never throws: a check that breaks is written as not checked. */
   async verify(entryId: string) {
      const entry = await prisma.competitionEntry.findUnique({
         where: { id: entryId },
         select: ENTRY_SELECT,
      });
      if (!entry || entry.state !== 'PENDING') return;
      const competition = await this.competitionFor(entry.competitionId);
      if (!competition) return;

      const report: ReportLine[] = [];
      const line = (
         code: CheckCode,
         status: ReportLine['status'],
         detail: string
      ) => report.push({ code, status, detail });
      const measure = competition.measure;
      const isVariety = competition.rule === 'SPECIES_VARIETY';

      const measureUrl = await readUrl(
         entry.measureImageKey,
         entry.measureImageUrl
      );
      const heroUrl = await readUrl(entry.heroImageKey, entry.heroImageUrl);
      const photoUrl = measureUrl ?? heroUrl;

      /* 1 and 2: a fish in the photo, and which fish. */
      let fingerprint: number[] | null = null;
      if (!photoUrl) {
         line('fish', 'flag', 'No photograph on the entry.');
         line('species', 'skip', 'No photograph to name the fish from.');
      } else {
         try {
            const seen = await visionService.inspect(photoUrl);
            if (!seen) {
               line('fish', 'skip', 'The fish namer is not connected.');
               line('species', 'skip', 'The fish namer is not connected.');
            } else {
               fingerprint = seen.embedding;
               if (!seen.fishFound) {
                  line('fish', 'flag', 'No fish found in the photograph.');
               } else {
                  line(
                     'fish',
                     'pass',
                     seen.fishCount > 1
                        ? `${seen.fishCount} fish in the photograph; the largest was checked.`
                        : 'A fish in the photograph.'
                  );
               }
               const declared = entry.speciesName ?? '';
               const target = competition.species?.commonName ?? null;
               const top = seen.candidates[0] ?? null;
               const names = seen.candidates.slice(0, 2);
               const matches = (name: string) => {
                  const g = norm(name);
                  const d = norm(declared);
                  return (
                     Boolean(d) && (g === d || g.includes(d) || d.includes(g))
                  );
               };
               const agrees = names.some(
                  (c) =>
                     (c.speciesId && c.speciesId === entry.speciesId) ||
                     matches(c.name) ||
                     (c.commonName ? matches(c.commonName) : false)
               );
               if (!declared) {
                  line('species', 'flag', 'The catch has no species.');
               } else if (
                  target &&
                  competition.speciesId &&
                  entry.speciesId !== competition.speciesId
               ) {
                  line(
                     'species',
                     'flag',
                     `This competition is for ${target}; the catch is a ${declared}.`
                  );
               } else if (!seen.fishFound) {
                  line('species', 'skip', 'No fish to name.');
               } else if (agrees) {
                  const c = names.find(
                     (n) =>
                        matches(n.name) ||
                        (n.commonName && matches(n.commonName)) ||
                        (n.speciesId && n.speciesId === entry.speciesId)
                  );
                  line(
                     'species',
                     'pass',
                     `The namer agrees: ${declared} (${Math.round((c?.confidence ?? 0) * 100)}%).`
                  );
               } else if (top && top.confidence >= NAMER_SURE) {
                  line(
                     'species',
                     'flag',
                     `The namer thinks this is ${top.commonName ?? top.name} (${Math.round(top.confidence * 100)}%), not ${declared}.`
                  );
               } else {
                  line(
                     'species',
                     'pass',
                     top
                        ? `The namer is not sure (best guess ${top.commonName ?? top.name}, ${Math.round(top.confidence * 100)}%); ${declared} stands.`
                        : `The namer had no guess; ${declared} stands.`
                  );
               }
            }
         } catch (error) {
            line('fish', 'skip', 'The fish namer did not answer.');
            line('species', 'skip', 'The fish namer did not answer.');
            console.warn('[entry:verify] namer', entryId, String(error));
         }
      }

      /* 3: the figure, read off the tape or scale. */
      let readValue: number | null = null;
      let readConfidence: number | null = null;
      let readNote: string | null = null;
      if (isVariety) {
         line(
            'figure',
            'pass',
            'No measurement needed for a most-species competition.'
         );
      } else if (!measureUrl) {
         line(
            'figure',
            'flag',
            `No photograph of the fish on the ${measure === 'LENGTH' ? 'tape' : 'scale'}.`
         );
      } else {
         try {
            const read = await visionService.readMeasure(measureUrl, measure);
            if (!read) {
               line('figure', 'skip', 'The photo reader is not switched on.');
            } else {
               readConfidence = read.confidence;
               readNote = read.note.slice(0, 280);
               const unitFits =
                  read.unit !== null &&
                  (measure === 'LENGTH'
                     ? read.unit === 'cm' || read.unit === 'in'
                     : read.unit === 'kg' || read.unit === 'lb');
               if (read.seen === 'none') {
                  line(
                     'figure',
                     'flag',
                     `No ${measure === 'LENGTH' ? 'tape' : 'scale'} in the photograph. ${read.note}`
                  );
               } else if (
                  read.value === null ||
                  !unitFits ||
                  read.confidence < SURE_ENOUGH
               ) {
                  line(
                     'figure',
                     'flag',
                     `Could not read the ${measure === 'LENGTH' ? 'tape' : 'scale'} well enough (${Math.round(read.confidence * 100)}% sure). ${read.note}`
                  );
               } else {
                  readValue = toMetric(
                     read.value,
                     read.unit as 'cm' | 'in' | 'kg' | 'lb'
                  );
                  const declared = entry.declaredValue;
                  if (declared === null) {
                     line(
                        'figure',
                        'pass',
                        `Read ${fmt(readValue, measure)} off the ${read.seen}; no typed figure to compare.`
                     );
                  } else {
                     const tolerance = Math.max(
                        0.05 * readValue,
                        measure === 'LENGTH' ? 1 : 0.1
                     );
                     const diff = Math.abs(readValue - declared);
                     if (diff <= tolerance) {
                        line(
                           'figure',
                           'pass',
                           `Read ${fmt(readValue, measure)} off the ${read.seen}; typed ${fmt(declared, measure)}.`
                        );
                     } else {
                        line(
                           'figure',
                           'flag',
                           `Read ${fmt(readValue, measure)} off the ${read.seen}, but ${fmt(declared, measure)} was typed.`
                        );
                     }
                  }
               }
            }
         } catch (error) {
            line('figure', 'skip', 'The photo reader did not answer.');
            console.warn('[entry:verify] reader', entryId, String(error));
         }
      }

      /* 4: the window. */
      {
         const start = competition.startsAt.getTime();
         const end = competition.endsAt.getTime();
         const caught = entry.caughtAt.getTime();
         const taken = entry.photoTakenAt?.getTime() ?? null;
         const submitted = entry.createdAt.getTime();
         if (caught < start || caught > end) {
            line(
               'window',
               'flag',
               'The catch time is outside the competition dates.'
            );
         } else if (
            taken !== null &&
            (taken < start - GRACE_MS || taken > end + GRACE_MS)
         ) {
            line(
               'window',
               'flag',
               'The photograph was taken outside the competition dates.'
            );
         } else if (submitted > end + LATE_MS) {
            line('window', 'flag', 'Submitted more than a day after the end.');
         } else {
            line(
               'window',
               'pass',
               taken !== null
                  ? 'Caught and photographed inside the dates.'
                  : 'Caught inside the dates (the photograph carried no time of its own).'
            );
         }
      }

      /* 5: the area. */
      {
         const here =
            entry.latitude !== null && entry.longitude !== null
               ? ([entry.latitude, entry.longitude] as [number, number])
               : null;
         if (competition.areaType === 'ANYWHERE') {
            line('area', 'pass', 'Anywhere counts.');
         } else if (!here) {
            if (entry.areaConfirmed) {
               line(
                  'area',
                  'pass',
                  `No position on the catch; the angler confirmed ${competition.areaName ?? 'the area'}.`
               );
            } else {
               line(
                  'area',
                  'flag',
                  'No position on the catch and the area was not confirmed.'
               );
            }
         } else if (competition.areaType === 'WATERBODY') {
            if (
               competition.areaLatitude === null ||
               competition.areaLongitude === null
            ) {
               line(
                  'area',
                  'pass',
                  `${competition.areaName ?? 'The waterbody'} has no position to check against.`
               );
            } else {
               const d = km(here, [
                  competition.areaLatitude,
                  competition.areaLongitude,
               ]);
               const radius = competition.areaRadiusKm ?? 25;
               if (d <= radius) {
                  line(
                     'area',
                     'pass',
                     `${Math.round(d)} km from ${competition.areaName ?? 'the waterbody'}, within ${radius} km.`
                  );
               } else {
                  line(
                     'area',
                     'flag',
                     `${Math.round(d)} km from ${competition.areaName ?? 'the waterbody'}, outside the ${radius} km allowed.`
                  );
               }
            }
         } else {
            try {
               const place = await namePlace(here[0], here[1]);
               const want = norm(
                  (competition.areaName ?? '').replace(/province/i, '')
               );
               const got = norm((place?.region ?? '').replace(/province/i, ''));
               if (!place || !got) {
                  line(
                     'area',
                     entry.areaConfirmed ? 'pass' : 'flag',
                     entry.areaConfirmed
                        ? 'Could not tell the province from the position; the angler confirmed the area.'
                        : 'Could not tell the province from the position.'
                  );
               } else if (
                  got === want ||
                  got.includes(want) ||
                  want.includes(got)
               ) {
                  line('area', 'pass', `Caught in ${place.region}.`);
               } else {
                  line(
                     'area',
                     'flag',
                     `Caught in ${place.region}, not ${competition.areaName}.`
                  );
               }
            } catch {
               line(
                  'area',
                  entry.areaConfirmed ? 'pass' : 'skip',
                  'Could not look the position up.'
               );
            }
         }
      }

      /* 6: the same fish twice. */
      {
         const others = await prisma.competitionEntry.findMany({
            where: {
               competitionId: entry.competitionId,
               id: { not: entry.id },
               state: { not: 'EXCLUDED' },
            },
            select: {
               id: true,
               heroImageKey: true,
               measureImageKey: true,
               fingerprint: true,
               user: { select: { displayName: true } },
            },
         });
         const samePhoto = others.find(
            (o) =>
               (entry.heroImageKey &&
                  (o.heroImageKey === entry.heroImageKey ||
                     o.measureImageKey === entry.heroImageKey)) ||
               (entry.measureImageKey &&
                  (o.measureImageKey === entry.measureImageKey ||
                     o.heroImageKey === entry.measureImageKey))
         );
         let sameFish: { name: string; sim: number } | null = null;
         if (!samePhoto && fingerprint) {
            for (const o of others) {
               const f = Array.isArray(o.fingerprint)
                  ? (o.fingerprint as number[])
                  : null;
               if (!f) continue;
               const sim = cosine(fingerprint, f);
               if (sim >= SAME_FISH && (!sameFish || sim > sameFish.sim)) {
                  sameFish = { name: o.user.displayName, sim };
               }
            }
         }
         if (samePhoto) {
            line(
               'duplicate',
               'flag',
               `The same photograph is already on ${samePhoto.user.displayName}'s entry.`
            );
         } else if (sameFish) {
            line(
               'duplicate',
               'flag',
               `Looks like the same fish as ${sameFish.name}'s entry (${Math.round(sameFish.sim * 100)}% alike).`
            );
         } else if (!fingerprint && others.length) {
            line(
               'duplicate',
               'pass',
               'No photograph reused; the fish itself could not be compared.'
            );
         } else {
            line(
               'duplicate',
               'pass',
               others.length ? 'Not entered before.' : 'The first entry.'
            );
         }
      }

      const flags = report
         .filter((l) => l.status === 'flag')
         .map((l) => l.code as string);
      if (
         report.some(
            (l) =>
               (l.code === 'species' || l.code === 'figure') &&
               l.status === 'skip'
         )
      ) {
         flags.push('unverified');
      }
      const value = readValue ?? entry.declaredValue ?? null;
      const state: EntryState =
         competition.checks === 'REVIEW' || flags.length ? 'HELD' : 'COUNTED';

      await prisma.competitionEntry.updateMany({
         where: { id: entry.id, state: 'PENDING' },
         data: {
            state,
            readValue,
            readConfidence,
            readNote,
            value,
            fingerprint: fingerprint ?? undefined,
            report: report as unknown as Prisma.InputJsonValue,
            flags: flags as unknown as Prisma.InputJsonValue,
         },
      });
   },

   async get(entryId: string) {
      return prisma.competitionEntry.findUnique({
         where: { id: entryId },
         select: ENTRY_SELECT,
      });
   },

   async listFor(competitionId: string) {
      return prisma.competitionEntry.findMany({
         where: { competitionId },
         orderBy: { createdAt: 'desc' },
         select: ENTRY_SELECT,
      });
   },

   /** Organiser: accept a held entry onto the board, or exclude any entry. */
   async review(
      userId: string,
      competitionId: string,
      entryId: string,
      action: 'accept' | 'exclude',
      note: string | null
   ) {
      const competition = await this.competitionFor(competitionId);
      if (!competition) return { error: 'not_found' as const };
      if (competition.createdById !== userId)
         return { error: 'not_organiser' as const };
      const entry = await prisma.competitionEntry.findFirst({
         where: { id: entryId, competitionId },
         select: { id: true, state: true },
      });
      if (!entry) return { error: 'not_found' as const };
      if (entry.state === 'PENDING')
         return { error: 'still_checking' as const };
      const updated = await prisma.competitionEntry.update({
         where: { id: entryId },
         data: {
            state: action === 'accept' ? 'COUNTED' : 'EXCLUDED',
            reviewedById: userId,
            reviewedAt: new Date(),
            reviewNote: note,
         },
         select: ENTRY_SELECT,
      });
      return { entry: updated };
   },

   /** Any entrant: hold an entry with a reason for the organiser. */
   async flag(
      userId: string,
      competitionId: string,
      entryId: string,
      reason: string
   ) {
      const competition = await this.competitionFor(competitionId);
      if (!competition) return { error: 'not_found' as const };
      const inIt =
         competition.createdById === userId ||
         (await this.isIn(competitionId, userId));
      if (!inIt) return { error: 'not_entered' as const };
      const entry = await prisma.competitionEntry.findFirst({
         where: { id: entryId, competitionId },
         select: { id: true, state: true, userId: true },
      });
      if (!entry) return { error: 'not_found' as const };
      if (entry.userId === userId) return { error: 'own_entry' as const };
      if (entry.state === 'EXCLUDED') return { error: 'excluded' as const };
      const updated = await prisma.competitionEntry.update({
         where: { id: entryId },
         data: {
            state: entry.state === 'PENDING' ? 'PENDING' : 'HELD',
            flaggedById: userId,
            flagReason: reason,
            flaggedAt: new Date(),
         },
         select: ENTRY_SELECT,
      });
      return { entry: updated };
   },

   /** Withdraw your own entry. */
   async withdraw(userId: string, competitionId: string, entryId: string) {
      const entry = await prisma.competitionEntry.findFirst({
         where: { id: entryId, competitionId, userId },
         select: { id: true },
      });
      if (!entry) return null;
      return prisma.competitionEntry.update({
         where: { id: entryId },
         data: { state: 'EXCLUDED', reviewNote: 'Withdrawn by the angler.' },
         select: ENTRY_SELECT,
      });
   },

   async shape(
      entry: EntryRow,
      viewer: { id: string | null; organiser: boolean; entrant: boolean }
   ): Promise<ShapedEntry> {
      const [heroUrl, measureUrl] = await Promise.all([
         readUrl(entry.heroImageKey, entry.heroImageUrl, 'card'),
         readUrl(entry.measureImageKey, entry.measureImageUrl),
      ]);
      let flaggedBy: string | null = null;
      if (entry.flaggedById) {
         const who = await prisma.user.findUnique({
            where: { id: entry.flaggedById },
            select: { displayName: true },
         });
         flaggedBy = who?.displayName ?? null;
      }
      const yours = viewer.id !== null && entry.userId === viewer.id;
      return {
         id: entry.id,
         anglerId: entry.userId,
         displayName: entry.user.displayName,
         username: entry.user.username,
         speciesName: entry.speciesName,
         value: entry.value,
         declaredValue: entry.declaredValue,
         readValue: entry.readValue,
         readConfidence: entry.readConfidence,
         state: entry.state,
         flags: Array.isArray(entry.flags) ? (entry.flags as string[]) : [],
         report: Array.isArray(entry.report)
            ? (entry.report as unknown as ReportLine[])
            : [],
         caughtAt: entry.caughtAt.toISOString(),
         note: entry.note,
         heroUrl,
         measureUrl,
         areaConfirmed: entry.areaConfirmed,
         flaggedBy,
         flagReason: entry.flagReason,
         reviewNote: entry.reviewNote,
         yours,
         canReview: viewer.organiser && entry.state !== 'PENDING',
         canFlag:
            viewer.entrant &&
            !yours &&
            (entry.state === 'COUNTED' || entry.state === 'PENDING'),
         createdAt: entry.createdAt.toISOString(),
      };
   },

   /** The board, from the counted entries only. */
   standings(
      competition: Pick<
         CompetitionForEntries,
         'rule' | 'measure' | 'timeZoneId' | 'maxPerSpeciesPerDay'
      >,
      entries: EntryRow[]
   ): Standing[] {
      const counted = entries.filter((e) => e.state === 'COUNTED');
      const byAngler = new Map<string, EntryRow[]>();
      for (const e of counted) {
         const list = byAngler.get(e.userId) ?? [];
         list.push(e);
         byAngler.set(e.userId, list);
      }
      const rows: Omit<Standing, 'place' | 'joint'>[] = [];
      for (const [anglerId, list] of byAngler) {
         const species = new Set(
            list.map((e) => e.speciesId ?? e.speciesName ?? 'unnamed')
         );
         const withValue = list.filter((e) => typeof e.value === 'number');
         const best = withValue.reduce<EntryRow | null>(
            (b, e) => (b === null || (e.value ?? 0) > (b.value ?? 0) ? e : b),
            null
         );
         let score: number;
         if (competition.rule === 'SPECIES_VARIETY') {
            score = species.size;
         } else if (competition.rule === 'BIGGEST_FISH') {
            score = best?.value ?? 0;
         } else {
            /* The best few fish per species per day, added up. */
            const buckets = new Map<string, number[]>();
            for (const e of withValue) {
               const key = `${e.speciesId ?? e.speciesName ?? 'unnamed'}|${localDay(e.caughtAt, competition.timeZoneId)}`;
               const b = buckets.get(key) ?? [];
               b.push(e.value ?? 0);
               buckets.set(key, b);
            }
            score = 0;
            for (const values of buckets.values()) {
               values.sort((a, b) => b - a);
               score += values
                  .slice(0, competition.maxPerSpeciesPerDay)
                  .reduce((s, v) => s + v, 0);
            }
         }
         rows.push({
            anglerId,
            displayName: list[0]!.user.displayName,
            username: list[0]!.user.username,
            score: Math.round(score * 1000) / 1000,
            bestValue: best?.value ?? null,
            bestSpeciesName: best?.speciesName ?? null,
            entries: list.length,
            distinctSpecies: species.size,
         });
      }
      rows.sort(
         (a, b) =>
            b.score - a.score ||
            (b.bestValue ?? 0) - (a.bestValue ?? 0) ||
            a.displayName.localeCompare(b.displayName)
      );
      const out: Standing[] = [];
      rows.forEach((row, i) => {
         const prev = out[i - 1];
         const place = prev && prev.score === row.score ? prev.place : i + 1;
         out.push({ ...row, place, joint: false });
      });
      for (const s of out) {
         s.joint = out.filter((o) => o.place === s.place).length > 1;
      }
      return out;
   },

   /** The catch to beat, for the listing. */
   leading(
      competition: Pick<CompetitionForEntries, 'rule'>,
      entries: EntryRow[]
   ): {
      displayName: string;
      value: number;
      speciesName: string | null;
   } | null {
      const counted = entries.filter((e) => e.state === 'COUNTED');
      if (!counted.length) return null;
      if (competition.rule === 'SPECIES_VARIETY') {
         const count = new Map<
            string,
            { name: string; species: Set<string> }
         >();
         for (const e of counted) {
            const c = count.get(e.userId) ?? {
               name: e.user.displayName,
               species: new Set<string>(),
            };
            c.species.add(e.speciesId ?? e.speciesName ?? 'unnamed');
            count.set(e.userId, c);
         }
         const top = [...count.values()].sort(
            (a, b) => b.species.size - a.species.size
         )[0]!;
         return {
            displayName: top.name,
            value: top.species.size,
            speciesName: null,
         };
      }
      const best = counted
         .filter((e) => typeof e.value === 'number')
         .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
      return best
         ? {
              displayName: best.user.displayName,
              value: best.value ?? 0,
              speciesName: best.speciesName,
           }
         : null;
   },

   /** A deleted catch leaves the board. */
   async excludeForCatch(tx: Prisma.TransactionClient, catchId: string) {
      await tx.competitionEntry.updateMany({
         where: { catchId, state: { not: 'EXCLUDED' } },
         data: { state: 'EXCLUDED', reviewNote: 'The catch was deleted.' },
      });
   },
};

export const unitOfMeasure = unitOf;
