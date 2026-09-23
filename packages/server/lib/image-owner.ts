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

/*
 * Whether an address is where that key is stored.
 *
 * Gear keeps its photograph as an address, not a key, and finds the key again
 * by looking the address up among the photographs. Its key was checked but its
 * address was not, so a piece of gear could carry the address of another
 * angler's photograph beside a key of its own, and show their photograph.
 *
 * The host and anything before the key differ with how the bucket is reached
 * (the public base, or the bucket's own address, path or host style), and the
 * query is a signature that is cut off before the address is kept. The key
 * does not differ: the address has to end in it, as whole path segments. A
 * file out of public/ is served at its own path, so there the path is the key.
 */
export const isAddressOfKey = (address: string, storageKey: string) => {
   let path: string;
   try {
      path = decodeURIComponent(new URL(address).pathname);
   } catch {
      return false;
   }
   if (storageKey.startsWith('/')) return path === storageKey;
   return path.endsWith(`/${storageKey}`);
};

/* The refusal, in the words the competition entry uses for a measure photo. */
export const notYourImage = {
   code: 'image_not_yours',
   message: 'That photo is not one of yours.',
};
