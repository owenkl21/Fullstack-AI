import type { Request, Response } from 'express';
import z from 'zod';
import { prisma } from '../lib/prisma';
import { visionService } from '../services/vision.service';

const readSchema = z.object({
   imageUrl: z.string().url().max(2048),
   measure: z.enum(['LENGTH', 'WEIGHT']),
});

const identifySchema = z.object({
   imageUrl: z.string().url().max(2048),
});

const norm = (text: string) =>
   text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

export const visionController = {
   /* The length or weight off a photograph, for a competition entry. */
   async readMeasure(req: Request, res: Response) {
      const parsed = readSchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }
      if (!visionService.available()) {
         return res.status(503).json({
            code: 'reader_off',
            message: 'The photo reader is not switched on for this server.',
         });
      }
      try {
         const reading = await visionService.readMeasure(
            parsed.data.imageUrl,
            parsed.data.measure
         );
         return res.json({ reading });
      } catch (error) {
         console.warn('[vision:read] failed', String(error));
         return res.status(502).json({
            code: 'reader_failed',
            message: 'The photo could not be read just now.',
         });
      }
   },

   /*
    * Which fish is in the photograph: the hub's guesses, matched to the
    * species table by common or scientific name, the best two.
    */
   async identify(req: Request, res: Response) {
      const parsed = identifySchema.safeParse(req.body);
      if (!parsed.success) {
         return res.status(400).json(parsed.error.format());
      }
      try {
         const guesses = await visionService.identify(parsed.data.imageUrl);
         if (guesses === null) {
            return res.status(503).json({
               code: 'namer_off',
               message: 'The fish namer is not connected.',
            });
         }
         const species = await prisma.species.findMany({
            select: { id: true, commonName: true, scientificName: true },
         });
         /*
          * The best two, in the namer's order. A fish the table already has
          * comes back as that row. One it does not is offered all the same,
          * by its common name where the namer knows one, with no id: the
          * form adds it as a species if the angler takes it, so the catch
          * can still be scored.
          */
         const candidates: {
            id: string | null;
            commonName: string;
            scientificName: string | null;
            confidence: number;
            guess: string;
            /* True when the name comes from anglers' confirmed catches. */
            learned?: boolean;
         }[] = [];
         for (const guess of guesses) {
            if (candidates.length === 2) break;
            const g = norm(guess.name);
            /* The hub learned this one from confirmed catches: it knows the row. */
            const learnt = guess.speciesId
               ? species.find((s) => s.id === guess.speciesId)
               : undefined;
            if (learnt) {
               if (candidates.some((m) => m.id === learnt.id)) continue;
               candidates.push({
                  id: learnt.id,
                  commonName: learnt.commonName,
                  scientificName: learnt.scientificName,
                  confidence: guess.confidence,
                  guess: guess.name,
                  learned: true,
               });
               continue;
            }
            const hit = species.find((s) => {
               const c = norm(s.commonName);
               const sci = norm(s.scientificName ?? '');
               return (
                  c === g ||
                  (sci && sci === g) ||
                  c.includes(g) ||
                  g.includes(c) ||
                  (sci && (g.includes(sci) || sci.includes(g)))
               );
            });
            if (hit) {
               if (candidates.some((m) => m.id === hit.id)) continue;
               candidates.push({
                  id: hit.id,
                  commonName: hit.commonName,
                  scientificName: hit.scientificName,
                  confidence: guess.confidence,
                  guess: guess.name,
               });
            } else {
               if (candidates.some((m) => norm(m.guess) === g)) continue;
               candidates.push({
                  id: null,
                  commonName: guess.commonName ?? guess.name,
                  scientificName: guess.name,
                  confidence: guess.confidence,
                  guess: guess.name,
               });
            }
         }
         return res.json({
            candidates,
            /* What the namer said, in its own words. */
            raw: guesses.slice(0, 3),
         });
      } catch (error) {
         console.warn('[vision:identify] failed', String(error));
         return res.status(502).json({
            code: 'namer_failed',
            message: 'The fish namer did not answer.',
         });
      }
   },
};
