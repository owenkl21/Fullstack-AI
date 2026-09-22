import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

/*
 * No baseURL. The client and the API are the same origin: through the Vite
 * proxy in development, through the Vercel rewrite in production. That is also
 * what keeps the session cookie first-party, so there is no SameSite=None and
 * nothing for Safari's third-party cookie blocking to reject.
 */
export const authClient = createAuthClient({
   /*
    * The server maps better-auth onto the existing users table and carries a
    * few of its own columns. Declared here so the session is typed with them
    * rather than cast at the call site.
    */
   plugins: [
      inferAdditionalFields({
         user: {
            username: { type: 'string', required: false },
            bio: { type: 'string', required: false },
            storagePrefixId: { type: 'string', required: false },
            /*
             * Who is running the app, so the menu can offer the admin panel
             * without a second request. The server writes both and refuses
             * them as input, and every admin route reads the role from the
             * database again: this is for showing a link, never for opening
             * one.
             */
            role: { type: 'string', required: false },
            verified: { type: 'boolean', required: false },
         },
      }),
   ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

export type SessionUser = {
   id: string;
   email: string;
   emailVerified: boolean;
   name: string;
   image?: string | null;
   username?: string | null;
   role?: string | null;
   verified?: boolean | null;
};

/** Whether the signed-in account may be shown the admin panel's link. */
export const isAdminSession = (
   user: { role?: string | null } | null | undefined
) => user?.role === 'ADMIN';

/**
 * True only once the session is known, so a caller can tell "signed out" apart
 * from "not fetched yet" and avoid flashing one state before the other.
 */
export function useIsSignedIn() {
   const { data, isPending } = useSession();
   return { isSignedIn: Boolean(data), isPending };
}
