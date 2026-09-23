import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

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

/*
 * Who is looking, for code that has no request to ask.
 *
 * A photograph's original carries the camera's EXIF, and on a phone that
 * includes where it was taken to a few metres. Only its owner may be handed
 * a link to it; everyone else gets the resized copy, which the browser drew
 * on a canvas and so carries no tags at all. The decision is made where every
 * link is signed, deep in the upload service, which is called from a dozen
 * places that were never given the viewer. Threading it through all of them
 * would leave the next new caller to forget; this lets the signer ask.
 *
 * Every request runs inside a scope with an empty viewer, and reading the
 * session fills it in. Nothing read outside a request finds a viewer, so the
 * answer there is the safe one: not the owner.
 */
type Viewer = { storagePrefixId: string | null };
const viewerScope = new AsyncLocalStorage<Viewer>();

export const requestScope = (
   _req: Request,
   _res: Response,
   next: NextFunction
) => viewerScope.run({ storagePrefixId: null }, next);

/* The R2 prefix of whoever this request is for, or null for a stranger. */
export const currentViewerPrefix = () =>
   viewerScope.getStore()?.storagePrefixId ?? null;

export const setAuthContext = (
   req: Request,
   user: { id: string; storagePrefixId?: string | null }
) => {
   const context = {
      userId: user.id,
      /*
       * Falls back to the id. A row written before storagePrefixId existed has
       * none, and keying uploads off nothing would put them at users/null/.
       */
      storagePrefixId: user.storagePrefixId ?? user.id,
   };
   (req as WithContext)[CONTEXT] = context;
   const viewer = viewerScope.getStore();
   if (viewer) viewer.storagePrefixId = context.storagePrefixId;
};

export const getAuth = (req: Request): AuthContext =>
   (req as WithContext)[CONTEXT] ?? EMPTY;
