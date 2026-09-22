import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth';
import { setAuthContext } from './auth-context';
import { prisma } from './prisma';

/*
 * Who runs the app, and the one account that carries the tick.
 *
 * There is no screen that makes somebody an admin and no column a request can
 * write. The role is granted here, from the address on the row, and only once
 * that address has been confirmed. The owner makes the account by signing up
 * the ordinary way; nothing about it is special until the confirmation link is
 * opened, and from then on every sign-in re-states the grant.
 *
 * This file and auth.ts import each other: auth.ts calls the grant from its
 * hooks, and requireAdmin below reads a session. Neither touches the other at
 * the top level, only inside a function, so whichever is loaded first finishes
 * evaluating before anything is called.
 */

const DEFAULT_ADMIN_EMAIL = 'info@fisherfeed.com';

/*
 * A list, so a second address can be added on the service without a deploy,
 * and so a test stack can point it somewhere harmless. Comma separated,
 * trimmed and lowercased, because an address typed into a dashboard arrives
 * with whatever spacing and capitals the typist used.
 */
export const ADMIN_EMAILS: readonly string[] = (
   process.env.ADMIN_EMAILS?.trim() || DEFAULT_ADMIN_EMAIL
)
   .split(',')
   .map((address) => address.trim().toLowerCase())
   .filter(Boolean);

/* The team's handle, normalised the way every stored handle is. */
export const TEAM_HANDLE = 'fisherfeedteam';

/**
 * Whether an address is one the app is run from.
 *
 * Case only. No trimming of dots or plus tags: a provider that treats
 * owen+admin@ as owen@ is the provider's business, and folding them here would
 * let somebody claim the role with an address that is not the one written
 * above. The comparison is against the address exactly as it was confirmed.
 */
export const isAdminEmail = (email: string | null | undefined): boolean =>
   Boolean(email) && ADMIN_EMAILS.includes(email!.trim().toLowerCase());

/** Whether a user row, as the database holds it, is an admin. */
export const isAdmin = (
   user: { role?: string | null } | null | undefined
): boolean => user?.role === 'ADMIN';

/*
 * Settle a row's role against its address.
 *
 * Called on sign-up, on every sign-in and the moment an address is confirmed,
 * so the account the app is run from becomes an admin without anybody touching
 * the database. An account whose address does not match is left exactly as it
 * was: this grants, it does not police. Anything else would mean that adding a
 * second way to make somebody an admin later would be quietly undone by the
 * next sign-in, which is a trap to leave lying around.
 *
 * The one exception is withdraw, below, and it is only used where we know the
 * address itself has just changed.
 *
 * An unconfirmed address grants nothing. That is the whole defence against an
 * impostor signing up as info@fisherfeed.com and never opening the mail: they
 * would hold the address on paper and never hold the role.
 *
 * Quiet on failure. This runs inside sign-in, and a grant that could not be
 * written is not a reason to refuse somebody their session; the next sign-in
 * tries again.
 */
export async function settleAdminRole(
   userId: string,
   options?: {
      /*
       * Take the role back when the address no longer matches. Set only from
       * the change-of-address flow, where the row's own address has just moved
       * and leaving the tick behind would mean an account with no claim to the
       * name still wearing it.
       */
      withdraw?: boolean;
   }
): Promise<void> {
   try {
      const user = await prisma.user.findUnique({
         where: { id: userId },
         select: {
            id: true,
            email: true,
            emailVerified: true,
            role: true,
            verified: true,
            username: true,
         },
      });
      if (!user) return;

      const owed = isAdminEmail(user.email) && user.emailVerified;

      if (!owed) {
         if (!options?.withdraw) return;
         /* Nothing to undo on an ordinary angler, which is almost every row
            that reaches this, so it costs a read and no write. */
         if (user.role === 'ANGLER' && !user.verified) return;
         await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ANGLER', verified: false },
         });
         return;
      }

      /*
       * The handle comes with the role, but only if the account has not
       * already picked one and nobody else is holding it. An ordinary angler
       * is still asked to choose their own: this is the one row that is given
       * one, because the name is the app's own and no angler may have it.
       */
      const handleHolder = user.username
         ? null
         : await prisma.user.findFirst({
              where: { username: TEAM_HANDLE, id: { not: user.id } },
              select: { id: true },
           });
      const takeHandle = !user.username && !handleHolder;

      if (user.role === 'ADMIN' && user.verified && !takeHandle) return;

      try {
         await prisma.user.update({
            where: { id: user.id },
            data: {
               role: 'ADMIN',
               verified: true,
               ...(takeHandle ? { username: TEAM_HANDLE } : {}),
            },
         });
      } catch (error) {
         /* Two sign-ins at once both found the handle free, and the unique
            index stopped the second. The role is what matters, so write that
            on its own rather than lose it to a name. */
         if (!takeHandle) throw error;
         await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', verified: true },
         });
      }
   } catch (error) {
      console.warn('[admin] Could not settle the role for a user.', {
         userId,
         error,
      });
   }
}

/**
 * Express middleware for anything only the admin may reach.
 *
 * The role is read from the database on every request, keyed by the session,
 * and never from anything the caller sent. A flag on the session is for
 * showing a link in the menu; it does not open a door.
 *
 * Refused by falling out of the router with next('router'), so the answer is
 * the same 404 Express gives for a path that was never registered. A 403 would
 * tell whoever is probing that the route is there and that they are simply not
 * the right person, which is a map of the admin surface handed to the one
 * person who should not have it.
 */
export async function requireAdmin(
   req: Request,
   _res: Response,
   next: NextFunction
): Promise<void> {
   const session = await auth.api
      .getSession({ headers: fromNodeHeaders(req.headers) })
      .catch(() => null);

   if (!session?.user) return next('router');

   const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, storagePrefixId: true, deletedAt: true },
   });

   if (!user || user.deletedAt || !isAdmin(user)) return next('router');

   setAuthContext(req, user);
   return next();
}
