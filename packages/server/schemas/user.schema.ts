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

/**
 * Why a normalised handle cannot be had, before anyone else is asked.
 *
 * allowReserved is the one door through the brand-word rule, and it is a
 * single exact handle rather than a flag: the admin account is given
 * fisherfeedteam and is refused fisherfeed_support along with everybody else.
 * The caller decides who gets it, because only the service knows who is
 * asking. The shape rules are checked first, so the exception cannot smuggle
 * through a handle with a capital or a space in it.
 */
export const handleProblemOf = (
   handle: string,
   options?: { allowReserved?: string | null }
): HandleProblem | null => {
   if (
      handle.length < HANDLE_MIN ||
      handle.length > HANDLE_MAX ||
      !HANDLE_PATTERN.test(handle)
   ) {
      return 'invalid';
   }

   if (options?.allowReserved && handle === options.allowReserved) {
      return null;
   }

   return RESERVED_HANDLES.has(handle) ||
      RESERVED_WITHIN.some((word) => handle.replaceAll('_', '').includes(word))
      ? 'reserved'
      : null;
};

/*
 * A display name read the way somebody glancing at a feed card reads it:
 * lowercase, and without the spaces, dots and punctuation that only look like
 * a gap. "Fisher.Feed Team" and "FisherfeedTeam" come out the same, which is
 * the point, because they pass for the same account.
 */
export const flattenName = (raw: string) =>
   raw.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Whether a display name passes for the app itself.
 *
 * Refused for everybody but the one account the app is run from, which the
 * service decides. The handle rule alone was not enough: a handle is small
 * grey text under a name set in 16px, and it is the name people read.
 */
export const nameIsBrand = (displayName: string) => {
   const flat = flattenName(displayName);
   return RESERVED_WITHIN.some((word) => flat.includes(word));
};

/*
 * Characters that draw a tick.
 *
 * The app draws one tick, beside one name, from a column the server alone
 * writes. A name ending in ✓ would sit in exactly the same place and read as
 * exactly the same thing, so the characters are refused in a name outright.
 * Nobody loses anything: this is punctuation nobody needs in what they are
 * called, and the account that really is verified gets the real mark drawn
 * for it.
 *
 * √ is in the list because it is the tick people reach for when the real one
 * is not on the keyboard, and beside a name it reads as one rather than as a
 * root sign.
 */
const TICK_MARKS = /[✓✔✅☑√\u{1F5F8}\u{1F5F9}]/u;

/**
 * Whether a display name draws its own tick.
 *
 * Exported because a display name is written from three places, not one: this
 * schema, better-auth's sign-up and better-auth's own name endpoint. The rule
 * only holds if all three ask, so there is one predicate for all three to ask
 * rather than a regex each.
 *
 * Refused for every account, the admin included: the real mark is drawn from
 * the column, so nobody needs to type one.
 */
export const nameHasTick = (displayName: string) =>
   TICK_MARKS.test(displayName);

export const updateProfileSchema = z
   .object({
      displayName: z
         .string()
         .trim()
         .min(2, 'Display name must be at least 2 characters.')
         .max(80, 'Display name must be less than 80 characters.')
         .refine(
            (value) => !nameHasTick(value),
            'A display name cannot use a tick mark.'
         )
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
