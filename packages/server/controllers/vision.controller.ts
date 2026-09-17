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
         const matches: {
            id: string;
            commonName: string;
            confidence: number;
            guess: string;
         }[] = [];
         for (const guess of guesses) {
            const g = norm(guess.name);
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
            if (hit && !matches.some((m) => m.id === hit.id)) {
               matches.push({
                  id: hit.id,
                  commonName: hit.commonName,
                  confidence: guess.confidence,
                  guess: guess.name,
               });
            }
         }
         return res.json({
            candidates: matches.slice(0, 2),
            /* What the namer said, for the angler to read when nothing matched. */
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
