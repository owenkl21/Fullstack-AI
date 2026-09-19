import type { Request } from 'express';

/*
 * The authenticated user, carried on the request.
 *
 * Deliberately the same shape Clerk's getAuth(req) returned, so the controllers
 * changed an import rather than their bodies. The meaning of userId did change:
 * it is now this app's own User.id, not an external provider's id.
 */

export type AuthContext = {
   userId: string | null;
   /*
    * The R2 key prefix. Objects live under users/<storagePrefixId>/, so this
    * has to stay stable independently of the auth id.
    */
   storagePrefixId: string | null;
};

const EMPTY: AuthContext = { userId: null, storagePrefixId: null };

/* A symbol rather than a string key, so nothing collides with Express itself. */
const CONTEXT = Symbol.for('fishlogger.auth');

type WithContext = Request & { [CONTEXT]?: AuthContext };

export const setAuthContext = (
   req: Request,
   user: { id: string; storagePrefixId?: string | null }
) => {
   (req as WithContext)[CONTEXT] = {
      userId: user.id,
      /*
       * Falls back to the id. A row written before storagePrefixId existed has
       * none, and keying uploads off nothing would put them at users/null/.
       */
      storagePrefixId: user.storagePrefixId ?? user.id,
   };
};

export const getAuth = (req: Request): AuthContext =>
   (req as WithContext)[CONTEXT] ?? EMPTY;
