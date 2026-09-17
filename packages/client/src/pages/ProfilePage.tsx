import axios from 'axios';
import { useCallback, useEffect, useId, useState } from 'react';
import {
   ConnectionsDialog,
   type ConnectionsKind,
} from '@/components/profile/ConnectionsDialog';
import { ProfileSettingsPanel } from '@/components/profile/ProfileSettingsPanel';
import { ProfileStatsPanel } from '@/components/social/ProfileStats';
import { RankCard } from '@/components/profile/RankCard';
import { ProfileView } from '@/components/profile/ProfileView';
import type {
   ProfileResponse,
   ProfileTallies,
   UserProfile,
} from '@/components/profile/types';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';

/*
 * Your own profile: the part anyone would see first, and the settings that change
 * it folded away underneath. Both read the same person, so a save updates the page
 * you are standing on rather than sending you somewhere else.
 */

type Status = 'loading' | 'ready' | 'error';

type CatchSummary = {
   id: string;
   title: string;
   length: number | null;
   site: { id: string; name: string } | null;
};

const LOAD_FAILED = 'Could not load your profile.';

export function ProfilePage() {
   useDocumentTitle('My profile');

   return (
      <RequireSignIn what="your profile">
         <ProfileScreen />
      </RequireSignIn>
   );
}

function ProfileScreen() {
   const settingsId = useId();

   const [profile, setProfile] = useState<UserProfile | null>(null);
   const [tallies, setTallies] = useState<ProfileTallies | null>(null);
   const [status, setStatus] = useState<Status>('loading');
   const [isReachable, setIsReachable] = useState(true);
   const [attempt, setAttempt] = useState(0);
   const [connections, setConnections] = useState<ConnectionsKind>('followers');
   const [connectionsOpen, setConnectionsOpen] = useState(false);
   const [settingsOpen, setSettingsOpen] = useState(false);

   useEffect(() => {
      const controller = new AbortController();

      axios
         .get<ProfileResponse>('/api/users/me', { signal: controller.signal })
         .then(({ data }) => {
            setProfile(data.profile);
            setIsReachable(data.storage !== 'clerk_fallback');
            setStatus('ready');
         })
         .catch((error: unknown) => {
            if (axios.isCancel(error)) {
               return;
            }

            console.error(error);
            setStatus('error');
         });

      return () => controller.abort();
   }, [attempt]);

   /* The figures are counted from the catches themselves; the profile endpoint
    * does not carry a total yet.
    * TODO(api): totals on the profile payload so this second call can go
    * (appendix E, the profile figures item). */
   useEffect(() => {
      const controller = new AbortController();

      axios
         .get<{ catches: CatchSummary[] }>('/api/catches/me', {
            signal: controller.signal,
         })
         .then(({ data }) => {
            const list = data.catches ?? [];
            const spots = new Set(
               list
                  .map((entry) => entry.site?.id)
                  .filter((id): id is string => Boolean(id))
            );
            const best = list.reduce<CatchSummary | null>(
               (longest, entry) =>
                  entry.length != null &&
                  (longest?.length == null || entry.length > longest.length)
                     ? entry
                     : longest,
               null
            );

            setTallies({
               catches: list.length,
               spots: spots.size,
               bestLengthCm: best?.length ?? null,
               bestCatchId: best?.id ?? null,
               bestCatchTitle: best?.title ?? null,
            });
         })
         .catch((error: unknown) => {
            if (axios.isCancel(error)) {
               return;
            }

            /* The figures are a nicety; the profile still reads without them. */
            console.error(error);
            setTallies(null);
         });

      return () => controller.abort();
   }, [attempt]);

   const retry = useCallback(() => {
      setStatus('loading');
      setAttempt((count) => count + 1);
   }, []);

   /* The sheet keeps the list it last opened while it closes, so nothing empties
    * out from under the exit. */
   const openConnections = useCallback((kind: ConnectionsKind) => {
      setConnections(kind);
      setConnectionsOpen(true);
   }, []);

   const onSaved = useCallback((saved: UserProfile) => {
      setProfile(saved);
      setIsReachable(true);
   }, []);

   return (
      <section className="mx-auto w-[min(820px,100%-32px)] py-10 md:py-14">
         {status === 'loading' ? (
            <ProfileSkeleton />
         ) : status === 'error' || !profile ? (
            <div>
               <h1 className="g text-[44px] md:text-[56px]">My profile</h1>
               <p
                  role="alert"
                  className="mt-4 max-w-[60ch] text-base text-ink-2"
               >
                  {LOAD_FAILED}
               </p>
               <Button
                  type="button"
                  variant="outline"
                  className="mt-6"
                  onClick={retry}
               >
                  Try again
               </Button>
            </div>
         ) : (
            <>
               {isReachable ? null : (
                  <p
                     role="status"
                     className="mb-8 border-l-[3px] border-teal bg-bg-2 px-4 py-3 text-[15px] text-ink-2"
                  >
                     Your catches, spots and followers are out of reach right
                     now, so only your name and photograph are shown. Your
                     changes are kept and will catch up.
                  </p>
               )}

               <ProfileView
                  profile={profile}
                  tallies={tallies}
                  figures={
                     <>
                        <RankCard own className="mt-8" />
                        <ProfileStatsPanel />
                     </>
                  }
                  onOpenConnections={openConnections}
               />

               <div className="mt-12 border-t border-line pt-6">
                  <h2 className="g text-[30px] md:text-[36px]">Settings</h2>
                  <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">
                     Your name, your handle, your bio and the photograph at the
                     top of this page.
                  </p>

                  <Button
                     type="button"
                     variant="outline"
                     className="mt-4"
                     aria-expanded={settingsOpen}
                     aria-controls={settingsId}
                     onClick={() => setSettingsOpen((open) => !open)}
                  >
                     {settingsOpen ? 'Close settings' : 'Edit your profile'}
                  </Button>

                  <div id={settingsId} hidden={!settingsOpen}>
                     <ProfileSettingsPanel
                        profile={profile}
                        onSaved={onSaved}
                     />
                  </div>
               </div>
            </>
         )}

         <ConnectionsDialog
            kind={connections}
            open={connectionsOpen}
            count={
               connections === 'followers'
                  ? (profile?.followersCount ?? 0)
                  : (profile?.followingCount ?? 0)
            }
            onClose={() => setConnectionsOpen(false)}
         />
      </section>
   );
}

function ProfileSkeleton() {
   return (
      <div role="status" aria-label="Loading your profile">
         <div className="flex items-center gap-4">
            <span className="size-16 shrink-0 rounded-full bg-bg-2" />
            <span className="flex flex-1 flex-col gap-3">
               <span className="block h-10 w-3/5 bg-bg-2" />
               <span className="block h-4 w-2/5 bg-bg-2" />
            </span>
         </div>
         <span className="mt-8 block h-4 w-full bg-bg-2" />
         <span className="mt-2 block h-4 w-4/5 bg-bg-2" />
         <div className="mt-10 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3, 4, 5].map((tile) => (
               <span key={tile} className="block aspect-square bg-bg-2" />
            ))}
         </div>
         <span className="sr-only">Loading your profile</span>
      </div>
   );
}
