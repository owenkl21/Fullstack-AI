import z from 'zod';

/*
 * What a handle is allowed to be.
 *
 * Lowercase only, so @Owen and @owen can never be two people. The column
 * already compares without case, but a handle that is stored the way it was
 * typed still reads as a different name on the page, and it is the name other
 * anglers type to find somebody.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 40;
const HANDLE_PATTERN = /^[a-z0-9_]+$/;

/*
 * Names a stranger could use to pass as the product or the people who run it,
 * and the words the app's own addresses are made of. Compared after the handle
 * is normalised, so ADMIN and @Admin are this list too.
 */
const RESERVED_HANDLES = new Set([
   'admin',
   'administrator',
   'support',
   'help',
   'fisherfeed',
   'fishlogger',
   'me',
   'settings',
   'account',
   'api',
   'anglers',
   'null',
   'undefined',
   'root',
   'system',
   'moderator',
   'staff',
   'official',
]);

/*
 * The product's name anywhere in a handle passes for the product as well as
 * the name alone does: fisherfeed_support reads as the help desk, and the
 * list above let it through. Read without underscores, so fisher_feed is the
 * same name with a gap in it.
 */
const RESERVED_WITHIN = ['fisherfeed', 'fishlogger'];

/**
 * @Owen, " owen " and OWEN are one handle: owen. The @ is how people write a
 * handle in a sentence, so one leading @ is taken as that and dropped.
 */
export const normaliseHandle = (raw: string) =>
   raw.trim().replace(/^@/, '').trim().toLowerCase();

export type HandleProblem = 'invalid' | 'reserved';

/** Why a normalised handle cannot be had, before anyone else is asked. */
export const handleProblemOf = (handle: string): HandleProblem | null => {
   if (
      handle.length < HANDLE_MIN ||
      handle.length > HANDLE_MAX ||
      !HANDLE_PATTERN.test(handle)
   ) {
      return 'invalid';
   }

   return RESERVED_HANDLES.has(handle) ||
      RESERVED_WITHIN.some((word) => handle.replaceAll('_', '').includes(word))
      ? 'reserved'
      : null;
};

export const updateProfileSchema = z
   .object({
      displayName: z
         .string()
         .trim()
         .min(2, 'Display name must be at least 2 characters.')
         .max(80, 'Display name must be less than 80 characters.')
         .optional(),
      /*
       * Normalised before it is checked, so what is validated is exactly what
       * is stored. The reserved words are the service's to refuse: an angler
       * who already holds one keeps it, and only the service knows who is
       * asking.
       */
      username: z
         .string()
         .transform(normaliseHandle)
         .pipe(
            z
               .string()
               .min(
                  HANDLE_MIN,
                  `Username must be at least ${HANDLE_MIN} characters.`
               )
               .max(
                  HANDLE_MAX,
                  `Username must be ${HANDLE_MAX} characters or fewer.`
               )
               .regex(
                  HANDLE_PATTERN,
                  'Username can only contain letters, numbers, and underscores.'
               )
         )
         .optional(),
      bio: z
         .string()
         .trim()
         .max(280, 'Bio must be 280 characters or less.')
         .nullable()
         .optional(),
      avatarUrl: z
         .string()
         .trim()
         .min(1, 'Avatar value must not be empty.')
         .max(512, 'Avatar value must be 512 characters or fewer.')
         .refine(
            (value) =>
               /^https?:\/\//i.test(value) || value.startsWith('users/'),
            'Avatar value must be a valid URL or storage key.'
         )
         .nullable()
         .optional(),
      /* The photograph across the top of a profile. Same rules as the avatar:
       * a URL or one of our own storage keys, never anything else. */
      bannerUrl: z
         .string()
         .trim()
         .min(1, 'Banner value must not be empty.')
         .max(512, 'Banner value must be 512 characters or fewer.')
         .refine(
            (value) =>
               /^https?:\/\//i.test(value) || value.startsWith('users/'),
            'Banner value must be a valid URL or storage key.'
         )
         .nullable()
         .optional(),
   })
   .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one profile field must be provided.',
      path: ['displayName'],
   });
