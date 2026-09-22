import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FishMark } from '@/components/brand/FishMark';
import { Img } from '@/components/Img';
import { Banner } from '@/components/profile/Banner';
import { RankCard } from '@/components/profile/RankCard';
import { FollowCounts } from '@/components/profile/FollowCounts';
import { VerifiedMark } from '@/components/profile/VerifiedMark';
import {
   initialOf,
   monthAndYear,
   type UserProfile,
} from '@/components/profile/types';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';
import { useGoBack } from '@/lib/go-back';

/*
 * Another angler, as anyone is allowed to see them.
 *
 * There was no way to reach a person at all: a name in the feed was text, and
 * the only profile route was your own. Everything here comes from the public
 * endpoint, which carries no email address and only the catches and spots that
 * angler marked public.
 */

type PublicProfile = UserProfile & {
   isYou?: boolean;
   followedByYou?: boolean;
};

type Status = 'loading' | 'ready' | 'missing' | 'error';

export function AnglerPage() {
   return (
      <RequireSignIn what="another angler's profile">
         <AnglerScreen />
      </RequireSignIn>
   );
}

function AnglerScreen() {
   const { userId } = useParams<{ userId: string }>();
   const goBack = useGoBack('/feed');

   const [profile, setProfile] = useState<PublicProfile | null>(null);
   const [status, setStatus] = useState<Status>('loading');
   const [busy, setBusy] = useState(false);

   useDocumentTitle(profile?.displayName);

   useEffect(() => {
      if (!userId) return;

      const controller = new AbortController();
      setStatus('loading');

      axios
         .get<{ profile: PublicProfile }>(`/api/users/${userId}`, {
            signal: controller.signal,
         })
         .then(({ data }) => {
            setProfile(data.profile);
            setStatus('ready');
         })
         .catch((error: unknown) => {
            if (axios.isCancel(error)) return;
            setStatus(
               axios.isAxiosError(error) && error.response?.status === 404
                  ? 'missing'
                  : 'error'
            );
         });

      return () => controller.abort();
   }, [userId]);

   /* Optimistic: the count and the label move at once, and go back if it fails. */
   const toggleFollow = useCallback(async () => {
      if (!profile || busy) return;

      const wasFollowing = Boolean(profile.followedByYou);
      setBusy(true);
      setProfile((current) =>
         current
            ? {
                 ...current,
                 followedByYou: !wasFollowing,
                 followersCount:
                    current.followersCount + (wasFollowing ? -1 : 1),
              }
            : current
      );

      try {
         await axios[wasFollowing ? 'delete' : 'post'](
            `/api/users/${profile.id}/follow`
         );
      } catch {
         setProfile((current) =>
            current
               ? {
                    ...current,
                    followedByYou: wasFollowing,
                    followersCount:
                       current.followersCount + (wasFollowing ? 1 : -1),
                 }
               : current
         );
      } finally {
         setBusy(false);
      }
   }, [profile, busy]);

   if (status === 'loading') {
      return (
         <section
            className="mx-auto w-[min(1680px,100%-32px)] py-10 md:py-14"
            role="status"
            aria-label="Loading the angler"
         >
            <div className="flex items-center gap-4">
               <span className="size-16 shrink-0 rounded-full bg-bg-2" />
               <span className="flex flex-1 flex-col gap-3">
                  <span className="block h-10 w-3/5 bg-bg-2" />
                  <span className="block h-4 w-2/5 bg-bg-2" />
               </span>
            </div>
         </section>
      );
   }

   if (status !== 'ready' || !profile) {
      return (
         <section className="mx-auto w-[min(1680px,100%-32px)] py-10 md:py-14">
            <h1 className="g text-[40px] md:text-[52px]">
               {status === 'missing' ? 'No such angler' : 'That did not load'}
            </h1>
            <p className="mt-4 max-w-[52ch] text-base text-ink-2">
               {status === 'missing'
                  ? 'This angler may have closed their account.'
                  : 'Something went wrong reading this profile.'}
            </p>
            <Button
               type="button"
               variant="outline"
               className="mt-6"
               onClick={goBack}
            >
               Go back
            </Button>
         </section>
      );
   }

   /*
    * Joined, not "fishing since": the public payload carries no catch dates, so
    * the only date here is the day the account was made. Saying that plainly
    * beats printing a sign-up month under the words "fishing since".
    */
   const joined = monthAndYear(profile.createdAt);

   return (
      <section className="mx-auto w-[min(1680px,100%-32px)] py-10 md:py-14">
         <header>
            <Banner url={profile.bannerUrl} cardUrl={profile.bannerCardUrl} />
            <div className="relative z-10 -mt-8 flex flex-wrap items-end gap-4">
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
                     className="g relative z-10 flex size-20 shrink-0 items-center justify-center rounded-full bg-bg-2 text-[26px] text-ink-2 ring-4 ring-background"
                  >
                     {initialOf(profile.displayName)}
                  </span>
               )}

               {/*
                * A basis wide enough for a word, so the row wraps the Follow
                * button onto its own line rather than squeezing the name into
                * a column narrower than it. Without it a name as long as the
                * app's own broke mid-word at 390 and read as FISHERFEE / D
                * TEAM. grow rather than flex-1, because flex-1 would set the
                * basis back to zero.
                */}
               <div className="min-w-0 grow basis-[14rem]">
                  <h1 className="g text-[40px] break-words md:text-[52px]">
                     {profile.displayName}
                     {profile.verified ? (
                        <VerifiedMark className="ml-2 size-[20px] align-[0.16em] md:size-[24px]" />
                     ) : null}
                  </h1>
                  {profile.username ? (
                     <p className="text-[15px] text-ink-2">
                        @{profile.username}
                     </p>
                  ) : null}
               </div>

               {profile.isYou ? (
                  <Button asChild variant="outline">
                     <Link to="/profile">Your profile</Link>
                  </Button>
               ) : (
                  <Button
                     type="button"
                     variant={profile.followedByYou ? 'outline' : 'default'}
                     onClick={() => void toggleFollow()}
                     disabled={busy}
                     aria-pressed={Boolean(profile.followedByYou)}
                  >
                     {profile.followedByYou ? 'Following' : 'Follow'}
                  </Button>
               )}
            </div>

            <p className="mt-6 max-w-[68ch] text-base whitespace-pre-line text-ink-2">
               {profile.bio?.trim() || 'No bio yet.'}
            </p>

            {joined ? <p className="lab num mt-4">Joined {joined}</p> : null}

            <FollowCounts
               className="mt-4"
               followers={profile.followersCount}
               following={profile.followingCount}
            />
         </header>

         <RankCard userId={profile.id} className="mt-8" />

         <section className="mt-10 border-t border-line pt-6">
            <h2 className="g text-[28px] md:text-[34px]">Photographs</h2>

            {profile.galleryImages.length === 0 ? (
               <div className="mt-4 flex items-center gap-3 text-ink-2">
                  <FishMark className="h-6 w-10 text-ink-3/50" />
                  {/*
                   * Careful wording: a private log is not an empty one, and this
                   * page cannot tell the difference. Saying "nothing public"
                   * rather than "nothing" is the honest version.
                   */}
                  <p className="text-base">Nothing public to show here yet.</p>
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
                           <Img
                              src={entry.url}
                              cardSrc={entry.cardUrl}
                              thumbSrc={entry.thumbUrl}
                              alt={entry.sourceTitle}
                              ratio="1 / 1"
                              /* A catch keeps its framing; a spot's
                                 photograph is centred as it always was. */
                              framing={
                                 entry.sourceType === 'CATCH'
                                    ? entry
                                    : undefined
                              }
                              /* Three up on a phone, four from the small
                                 breakpoint on. */
                              sizes="(min-width: 640px) 25vw, 33vw"
                              className="size-full"
                              imgClassName="transition-transform duration-[600ms] [transition-timing-function:var(--ease)] group-hover:scale-[1.04]"
                           />
                        </Link>
                     </li>
                  ))}
               </ul>
            )}
         </section>
      </section>
   );
}
