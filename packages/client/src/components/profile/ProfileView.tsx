import { type CSSProperties, type ReactNode, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon } from '@heroicons/react/24/outline';
import { FishMark } from '@/components/brand/FishMark';
import { useRevealIn } from '@/components/brand/Reveal';
import type { ConnectionsKind } from '@/components/profile/ConnectionsDialog';
import {
   initialOf,
   monthAndYear,
   plural,
   type ProfileTallies,
   type UserProfile,
} from '@/components/profile/types';

/*
 * The angler as other anglers would read them: a photograph, a name, a handle, a
 * few lines in their own words, and what the log adds up to written as sentences
 * rather than stacked into tiles. The photographs link to the records they came
 * from.
 */

export function ProfileView({
   profile,
   tallies,
   figures,
   onOpenConnections,
}: {
   profile: UserProfile;
   tallies: ProfileTallies | null;
   /* The counted figures, slotted in here so they land above the photographs
    * rather than after them. An empty shelf should not outrank real numbers. */
   figures?: ReactNode;
   onOpenConnections: (kind: ConnectionsKind) => void;
}) {
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   const since = monthAndYear(profile.createdAt);
   const bio = profile.bio?.trim();
   /*
    * These sit inside a sentence, so the 44px target goes around the words
    * rather than being the words. As an h-11 inline-flex box each one opened a
    * gap in the middle of the line it was part of.
    */
   const control =
      'tap-inline text-teal-text underline-offset-4 transition-colors duration-150 [transition-timing-function:var(--ease)] hover:underline';

   return (
      <div ref={root}>
         <header className="rv">
            <div className="flex items-center gap-4">
               {profile.avatarUrl ? (
                  <img
                     src={profile.avatarUrl}
                     alt=""
                     width={64}
                     height={64}
                     className="size-16 shrink-0 rounded-full object-cover"
                  />
               ) : (
                  <span
                     aria-hidden="true"
                     className="g flex size-16 shrink-0 items-center justify-center rounded-full bg-bg-2 text-[30px] text-ink-2"
                  >
                     {initialOf(profile.displayName)}
                  </span>
               )}
               <div className="min-w-0">
                  <h1 className="g text-[44px] break-words md:text-[56px]">
                     {profile.displayName}
                  </h1>
                  {profile.username ? (
                     <p className="text-[15px] text-ink-2">
                        @{profile.username}
                     </p>
                  ) : null}
               </div>
            </div>

            <p className="mt-6 max-w-[68ch] text-base whitespace-pre-line text-ink-2">
               {bio ? bio : 'No bio yet.'}
            </p>

            {since ? (
               <p className="lab num mt-4">Fishing since {since}</p>
            ) : null}
         </header>

         <section
            className="rv mt-8 border-t border-line pt-6"
            style={{ '--i': 1 } as CSSProperties}
         >
            <h2 className="sr-only">What the log adds up to</h2>

            {tallies ? (
               <p className="num text-base text-ink">
                  {tallies.catches === 0
                     ? 'No catches logged yet.'
                     : tallies.spots === 0
                       ? `${plural(tallies.catches, 'catch', 'catches')}, none at a saved spot.`
                       : `${plural(tallies.catches, 'catch', 'catches')} at ${plural(tallies.spots, 'spot')}.`}
               </p>
            ) : null}

            {tallies?.bestCatchId && tallies.bestLengthCm ? (
               <p className="num mt-2 text-base text-ink-2">
                  Longest so far,{' '}
                  <Link
                     to={`/catches/${tallies.bestCatchId}`}
                     className="text-teal-text underline-offset-4 hover:underline"
                  >
                     {tallies.bestCatchTitle ?? 'that catch'}
                  </Link>{' '}
                  at {tallies.bestLengthCm} cm (
                  {(tallies.bestLengthCm / 2.54).toFixed(1)} in).
               </p>
            ) : null}

            <p className="num mt-1 text-base text-ink-2">
               <button
                  type="button"
                  className={control}
                  onClick={() => onOpenConnections('followers')}
               >
                  {plural(profile.followersCount, 'follower')}
               </button>
               , following{' '}
               <button
                  type="button"
                  className={control}
                  onClick={() => onOpenConnections('following')}
               >
                  {profile.followingCount}
               </button>
               .
            </p>
         </section>

         {figures}

         <section className="rv mt-10" style={{ '--i': 2 } as CSSProperties}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
               <h2 className="g text-[30px] md:text-[36px]">Photographs</h2>
               {profile.galleryImages.length > 0 ? (
                  <p className="lab num">
                     {plural(profile.galleryImages.length, 'photo')}
                  </p>
               ) : null}
            </div>

            {profile.galleryImages.length === 0 ? (
               /*
                * An empty shelf, drawn rather than described. The frames show
                * what will sit here, so the gap reads as room for photographs
                * rather than as something that failed to load.
                */
               <div className="mt-5">
                  <ul
                     aria-hidden="true"
                     className="grid max-w-[420px] grid-cols-4 gap-2"
                  >
                     {[0, 1, 2, 3].map((frame) => (
                        <li
                           key={frame}
                           className="flex h-[72px] items-center justify-center border border-dashed border-line"
                        >
                           <FishMark className="h-6 w-10 text-ink-3/45" />
                        </li>
                     ))}
                  </ul>
                  <p className="mt-4 max-w-[60ch] text-base text-ink-2">
                     Photographs you attach to a catch or a spot collect here.
                  </p>
                  <Link
                     to="/log"
                     className="g-tracked mt-4 inline-flex min-h-11 items-center gap-2 border border-line px-4 text-[15px] transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2"
                  >
                     <CameraIcon aria-hidden="true" className="size-[18px]" />
                     Log a catch with a photo
                  </Link>
               </div>
            ) : (
               <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {profile.galleryImages.map((entry) => (
                     <li
                        key={`${entry.sourceType}-${entry.sourceId}-${entry.id}`}
                     >
                        <Link
                           to={
                              entry.sourceType === 'CATCH'
                                 ? `/catches/${entry.sourceId}`
                                 : `/sites/${entry.sourceId}`
                           }
                           className="group block aspect-square w-full overflow-hidden bg-bg-2"
                        >
                           <img
                              src={entry.url}
                              alt={entry.sourceTitle}
                              loading="lazy"
                              className="size-full object-cover transition-transform duration-[600ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.04]"
                           />
                        </Link>
                     </li>
                  ))}
               </ul>
            )}
         </section>
      </div>
   );
}
