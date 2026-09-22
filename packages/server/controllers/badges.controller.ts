import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import {
   badgesService,
   isBadgeKind,
   NOTE_LIMIT,
} from '../services/badges.service';

/* Express can hand back a repeated route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

/*
 * Awarding and taking off a badge.
 *
 * Every route in here is mounted behind requireAdmin (lib/admin.ts), which
 * reads the role off the database row behind the session on every request and
 * drops everybody else out of the router, so an angler gets the same 404 they
 * would get for a path that was never registered. Nothing here re-decides that
 * question, and nothing here reads a role, a flag or an id from the request
 * body: the admin's own id comes from the session the guard already read.
 *
 * A catch that is not there and a kind that is not a kind are told apart,
 * because both answers are only ever read by an admin.
 */

const notFound = {
   code: 'catch_not_found',
   message: 'That catch is not here.',
};

const badKind = {
   code: 'badge_kind_unknown',
   message: 'That is not a badge.',
};

export const badgesController = {
   async award(req: Request, res: Response) {
      const auth = getAuth(req);
      /* The guard sets this. Belt and braces: a route wired up without it
         would otherwise award in nobody's name. */
      if (!auth.userId) return res.status(404).json(notFound);

      const catchId = asSingleParam(req.params.catchId);
      if (!catchId) return res.status(404).json(notFound);

      const body = (req.body ?? {}) as { kind?: unknown; note?: unknown };
      if (!isBadgeKind(body.kind)) return res.status(400).json(badKind);

      const note =
         typeof body.note === 'string'
            ? body.note.trim().slice(0, NOTE_LIMIT)
            : null;

      const result = await badgesService.award({
         catchId,
         kind: body.kind,
         adminId: auth.userId,
         note,
      });
      if (!result) return res.status(404).json(notFound);

      return res.status(result.created ? 201 : 200).json(result);
   },

   async remove(req: Request, res: Response) {
      const catchId = asSingleParam(req.params.catchId);
      const kind = asSingleParam(req.params.kind);
      if (!catchId) return res.status(404).json(notFound);
      if (!isBadgeKind(kind)) return res.status(400).json(badKind);

      return res.json(await badgesService.remove({ catchId, kind }));
   },

   /** Every badge on one fish, for the picker to open on what is already there. */
   async list(req: Request, res: Response) {
      const catchId = asSingleParam(req.params.catchId);
      if (!catchId) return res.status(404).json(notFound);
      return res.json({ badges: await badgesService.listForCatch(catchId) });
   },
};
