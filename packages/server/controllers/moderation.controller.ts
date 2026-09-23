import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuth } from '../lib/auth-context';
import {
   cleanOptional,
   moderationWords,
   REFUSED_WORDING,
} from '../lib/moderation';
import { moderationService } from '../services/moderation.service';

/*
 * Reporting, for anyone signed in, and the team's side of it. The admin routes
 * sit behind the admin guard in routes.ts; nothing here checks a role again,
 * because a second place to decide is a second place to get it wrong.
 */

const idSchema = z.string().trim().min(1).max(64);

const reportSchema = z.object({
   reason: z.enum(['SPAM', 'ABUSE', 'LANGUAGE', 'IMAGE', 'OTHER']),
   note: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .optional()
      .nullable()
      .transform(cleanOptional),
});

const resolveSchema = z.object({
   key: z
      .string()
      .trim()
      .regex(/^(post|comment):[A-Za-z0-9_-]{1,64}$/),
   action: z.enum(['remove', 'keep']),
});

const wordsSchema = z.object({
   mask: z.array(z.string().max(40)).max(500),
   block: z.array(z.string().max(40)).max(500),
});

/* What a reporter is told, in the app's own words. */
const REPORT_WORDS = {
   reported: 'Thanks. The Fisherfeed team will have a look.',
   already: 'You have reported this already. The team will have a look.',
   own: 'That is yours, so there is nothing to report.',
   gone: 'That is not there any more.',
} as const;

async function report(
   req: Request,
   res: Response,
   kind: 'post' | 'comment',
   rawId: unknown
) {
   const auth = getAuth(req);
   if (!auth.userId) {
      return res.status(401).json({ code: 'unauthorized' });
   }
   const id = idSchema.safeParse(rawId);
   const body = reportSchema.safeParse(req.body ?? {});
   if (!id.success || !body.success) {
      /* A note with a slur in it is refused in the words any other text is. */
      const refused =
         !body.success &&
         body.error.issues.some((issue) => issue.message === REFUSED_WORDING);
      return res.status(400).json({
         code: 'bad_request',
         message: refused ? REFUSED_WORDING : 'Say why you are reporting it.',
      });
   }
   const result = await moderationService.report(
      auth.userId,
      { kind, id: id.data },
      body.data.reason,
      body.data.note ?? null
   );
   if (result.status === 'gone') {
      return res
         .status(404)
         .json({ code: 'not_found', message: REPORT_WORDS.gone });
   }
   return res.json({ ...result, message: REPORT_WORDS[result.status] });
}

export const moderationController = {
   reportPost: (req: Request, res: Response) =>
      report(req, res, 'post', req.params.postId),

   reportComment: (req: Request, res: Response) =>
      report(req, res, 'comment', req.params.commentId),

   async queue(_req: Request, res: Response) {
      return res.json(await moderationService.queue());
   },

   async resolve(req: Request, res: Response) {
      const auth = getAuth(req);
      const body = resolveSchema.safeParse(req.body ?? {});
      if (!body.success) {
         return res.status(400).json({ code: 'bad_request' });
      }
      const done = await moderationService.resolve(
         auth.userId!,
         body.data.key,
         body.data.action
      );
      if (!done) return res.status(404).json({ code: 'not_found' });
      return res.json(done);
   },

   async removePost(req: Request, res: Response) {
      const auth = getAuth(req);
      const id = idSchema.safeParse(req.params.postId);
      if (!id.success) return res.status(400).json({ code: 'bad_request' });
      return res.json(
         await moderationService.remove(auth.userId!, {
            kind: 'post',
            id: id.data,
         })
      );
   },

   async removeComment(req: Request, res: Response) {
      const auth = getAuth(req);
      const id = idSchema.safeParse(req.params.commentId);
      if (!id.success) return res.status(400).json({ code: 'bad_request' });
      return res.json(
         await moderationService.remove(auth.userId!, {
            kind: 'comment',
            id: id.data,
         })
      );
   },

   words(_req: Request, res: Response) {
      return res.json(moderationWords.read());
   },

   async saveWords(req: Request, res: Response) {
      const body = wordsSchema.safeParse(req.body ?? {});
      if (!body.success) {
         return res.status(400).json({
            code: 'bad_request',
            message: 'Each list is words of up to forty letters.',
         });
      }
      return res.json(await moderationWords.save(body.data));
   },

   async resetWords(_req: Request, res: Response) {
      return res.json(await moderationWords.reset());
   },
};
