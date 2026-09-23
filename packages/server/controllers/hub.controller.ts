import type { Request, Response } from 'express';
import { announceHub, isHubToken } from '../lib/hub';

/*
 * The hub saying where it is. Signed with the fish namer's own token, not a
 * session: the caller is a timer on a PC, not a person. Without the token, or
 * with none set on the server, the route is not there.
 */
export const hubController = {
   async announce(req: Request, res: Response) {
      if (!isHubToken(req.headers.authorization)) {
         return res.status(404).json({ code: 'not_found' });
      }
      const status = await announceHub(
         (req.body as { url?: unknown } | undefined)?.url
      );
      const code =
         status === 'saved' || status === 'same'
            ? 200
            : status === 'refused'
              ? 400
              : 502;
      return res.status(code).json({ status });
   },
};
