import type { AuthContext } from './auth-context';

/*
 * Whether a photograph's key is the caller's to put on something.
 *
 * Every upload is signed under users/<storagePrefixId>/ (uploads.service), so
 * a key anywhere else is another angler's photograph. A catch, a spot, a piece
 * of gear and a profile used to take whatever key they were sent: one angler
 * could hang another's photograph on their own catch, and the upsert behind a
 * catch even rewrote that photograph's address on its owner's row.
 *
 * A key that starts with a single / is a file the client serves out of
 * public/ (the seed's photographs), which is nobody's. Two slashes would be an
 * address on some other server, handed straight to every browser that draws
 * it, and a key with .. in it names nothing an upload ever made.
 */
export const isOwnImageKey = (
   auth: Pick<AuthContext, 'userId' | 'storagePrefixId'>,
   storageKey: string
) => {
   if (storageKey.includes('..') || storageKey.includes('\\')) return false;
   if (storageKey.startsWith('/')) return !storageKey.startsWith('//');
   const prefix = auth.storagePrefixId ?? auth.userId;
   return Boolean(prefix) && storageKey.startsWith(`users/${prefix}/`);
};

/* The refusal, in the words the competition entry uses for a measure photo. */
export const notYourImage = {
   code: 'image_not_yours',
   message: 'That photo is not one of yours.',
};
