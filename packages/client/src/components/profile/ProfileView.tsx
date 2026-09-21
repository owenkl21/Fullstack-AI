import { Fold } from '@/components/ui/fold';
import { type CSSProperties, type ReactNode, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon } from '@heroicons/react/24/outline';
import { Banner } from '@/components/profile/Banner';
import { FollowCounts } from '@/components/profile/FollowCounts';
import { FishMark } from '@/components/brand/FishMark';
import { Img } from '@/components/Img';
import { useRevealIn } from '@/components/brand/Reveal';
import type { ConnectionsKind } from '@/components/profile/ConnectionsDialog';
import {
   initialOf,
   monthAndYear,
   plural,
   type GalleryImage,
   type ProfileTallies,
   type UserProfile,
} from '@/components/profile/types';
import { formatLength, readUnitSystem } from '@/lib/units';

/*
 * The angler as other anglers would read them: a photograph, a name, a handle, a
 * few lines in their own words, and what the log adds up to written as sentences
 * rather than stacked into tiles. The photographs link to the records they came
 * from.
 */

export function ProfileView({
   profile,
   tallies,
   gallery,
   figures,
   onOpenConnections,
}: {
   profile: UserProfile;
   tallies: ProfileTallies | null;
   /* The photographs to show, counted from the whole log rather than from the
    * handful of catches the profile payload carries. */
   gallery?: GalleryImage[];
   /* The counted figures, slotted in here so they land above the photographs
    * rather than after them. An empty shelf should not outrank real numbers. */
   figures?: ReactNode;
   onOpenConnections: (kind: ConnectionsKind) => void;
}) {
   const root = useRef<HTMLDivElement>(null);
   useRevealIn(root);

   /*
    * Since the first fish, not since the sign-up. An angler who wrote up last
    * season on the day they joined was told they had been fishing since this
    * month, four lines above a log that starts in December.
    */
   const firstFish = monthAndYear(tallies?.firstCaughtAt);
   const joined = monthAndYear(profile.createdAt);
   const photographs = gallery ?? profile.galleryImages;
   const bio = profile.bio?.trim();
   return (
      <div ref={root}>
         <header className="rv">
            <Banner url={profile.bannerUrl} cardUrl={profile.bannerCardUrl} />
            {/* The photograph sits over the banner's bottom edge, which is
                what makes the two read as one picture of a person. */}
            <div className="relative z-10 -mt-8 flex items-end gap-4">
               {profile.avatarUrl ? (
                  <Img
                     src={profile.avatarUrl}
                     thumbSrc={profile.avatarThumbUrl}
                     alt=""
                     priority
                     ratio="1 / 1"
                     sizes="80px"
                     className="relative z-10 size-20 shrink-0 rounded-full ring-4 ring-background"
                  />
               ) : (
                  <span
                     aria-hidden="true"
                     className="g relative z-10 flex size-20 shrink-0 items-center justify-center rounded-full bg-bg-2 text-[30px] text-ink-2 ring-4 ring-background"
                  >
                     {initialOf(profile.displayName)}
                  </span>
               )}
               <div className="min-w-0">
                  <h1 className="g text-[44px] leading-none break-words hyphens-auto md:text-[56px]">
                     {profile.displayName}
                  </h1>
                  {profile.username ? (
                     <p className="mt-1 text-[15px] break-all text-ink-2">
                        @{profile.username}
                     </p>
                  ) : null}
               </div>
            </div>

            <p className="mt-6 max-w-[68ch] text-base whitespace-pre-line text-ink-2">
               {bio ? bio : 'No bio yet.'}
            </p>

            {firstFish ? (
               <p className="lab num mt-4">Fishing since {firstFish}</p>
            ) : joined ? (
               <p className="lab num mt-4">Joined {joined}</p>
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
                  at {formatLength(tallies.bestLengthCm, readUnitSystem())}.
               </p>
            ) : null}

            {/* The way to more people, beside the counts of the people you
                already have, which is where anyone looks for it. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
               <FollowCounts
                  followers={profile.followersCount}
                  following={profile.followingCount}
                  onOpen={onOpenConnections}
               />
               <Link
                  to="/anglers"
                  className="g-tracked inline-flex min-h-11 items-center text-[19px] text-teal-text underline-offset-4 hover:underline"
               >
                  Find anglers
               </Link>
            </div>
         </section>

         {figures}

         <section
            className="rv mt-10 border-t border-line pt-2"
            style={{ '--i': 2 } as CSSProperties}
         >
            {/*
             * Open, when there are photographs to see. A shelf of an angler's
             * own pictures is the reason to open a profile at all, and it was
             * folded away behind a heading, which reads as a profile that has
             * none. Empty, it stays shut: a closed heading is a tidier way to
             * say "nothing here yet" than four dashed frames.
             */}
            <Fold
               /* The fold takes `open` as a starting state, and the
                  photographs arrive a moment after the name does. The key
                  flips once, when the first one lands, so the shelf opens
                  itself rather than sitting shut over a count. */
               key={photographs.length > 0 ? 'photographs' : 'empty'}
               title="Photographs"
               open={photographs.length > 0}
               aside={
                  photographs.length > 0
                     ? plural(photographs.length, 'photo')
                     : null
               }
            >
               {photographs.length === 0 ? (
                  /*
                   * An empty shelf, drawn rather than described. The frames show
                   * what will sit here, so the gap reads as room for photographs
                   * rather than as something that failed to load.
                   */
                  <div className="mt-5">
                     <ul
                        aria-hidden="true"
                        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                     >
                        {[0, 1, 2, 3].map((frame) => (
                           <li
                              key={frame}
                              className="flex aspect-[4/3] items-center justify-center border border-dashed border-line"
                           >
                              <FishMark className="h-10 w-16 text-ink-3/45" />
                           </li>
                        ))}
                     </ul>
                     <p className="mt-4 max-w-[60ch] text-base text-ink-2">
                        Photographs you attach to a catch or a spot collect
                        here.
                     </p>
                     <Link
                        to="/log"
                        className="g-tracked mt-4 inline-flex min-h-11 items-center gap-2 border border-line px-4 text-[15px] transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2"
                     >
                        <CameraIcon
                           aria-hidden="true"
                           className="size-[18px]"
                        />
                        Log a catch with a photo
                     </Link>
                  </div>
               ) : (
                  <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                     {photographs.map((entry) => (
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
                              <Img
                                 src={entry.url}
                                 cardSrc={entry.cardUrl}
                                 thumbSrc={entry.thumbUrl}
                                 alt={entry.sourceTitle}
                                 ratio="1 / 1"
                                 /* Two up on a phone, three on a tablet, four
                                    on the widest column the page draws. */
                                 sizes="(min-width: 1280px) 400px, (min-width: 640px) 33vw, 50vw"
                                 className="size-full"
                                 imgClassName="transition-transform duration-[600ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.04]"
                              />
                           </Link>
                        </li>
                     ))}
                  </ul>
               )}
            </Fold>
         </section>
      </div>
   );
}
