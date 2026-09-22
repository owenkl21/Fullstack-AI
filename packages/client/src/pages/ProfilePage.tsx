import axios from 'axios';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
   ConnectionsDialog,
   type ConnectionsKind,
} from '@/components/profile/ConnectionsDialog';
import { ProfileSettingsPanel } from '@/components/profile/ProfileSettingsPanel';
import { DeviceSettings } from '@/components/notifications/DeviceSettings';
import { ProfileStatsPanel } from '@/components/social/ProfileStats';
import { RankCard } from '@/components/profile/RankCard';
import { ProfileView } from '@/components/profile/ProfileView';
import {
   fetchMyProfile,
   settleMyAvatar,
} from '@/components/profile/avatar-api';
import {
   fetchMyCatches,
   type CatchSummary,
} from '@/components/fishing/record/api';
import type {
   GalleryImage,
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

/*
 * The catches endpoint signs a card and a thumb beside every photograph, which
 * the shared CatchImage type does not list yet. Read them here rather than
 * loading a four megabyte original into a gallery tile.
 */
type SignedImage = {
   id: string;
   url: string;
   cardUrl?: string | null;
   thumbUrl?: string | null;
};

const LOAD_FAILED = 'Could not load your profile.';

/* Newest fish first, and one entry per photograph on it. */
const photographsFrom = (catches: CatchSummary[]): GalleryImage[] =>
   [...catches]
      .sort((a, b) => b.caughtAt.localeCompare(a.caughtAt))
      .flatMap((entry) =>
         (entry.images ?? []).map((held) => {
            const image = held.image as SignedImage;
            return {
               id: image.id,
               url: image.url,
               cardUrl: image.cardUrl ?? null,
               thumbUrl: image.thumbUrl ?? null,
               sourceType: 'CATCH' as const,
               sourceId: entry.id,
               sourceTitle: entry.title,
            };
         })
      );

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
   const [photographs, setPhotographs] = useState<GalleryImage[] | null>(null);
   const [status, setStatus] = useState<Status>('loading');
   const [attempt, setAttempt] = useState(0);
   const [connections, setConnections] = useState<ConnectionsKind>('followers');
   const [connectionsOpen, setConnectionsOpen] = useState(false);
   const [settingsOpen, setSettingsOpen] = useState(false);

   /* Shared with the header's circle, so a cold load of this page reads the
    * angler once rather than twice. */
   useEffect(() => {
      let cancelled = false;

      fetchMyProfile()
         .then((loaded) => {
            if (cancelled) {
               return;
            }

            if (!loaded) {
               setStatus('error');
               return;
            }

            setProfile(loaded);
            setStatus('ready');
         })
         .catch((error: unknown) => {
            if (cancelled || axios.isCancel(error)) {
               return;
            }

            console.error(error);
            setStatus('error');
         });

      return () => {
         cancelled = true;
      };
   }, [attempt]);

   /* The figures, the first fish and the photographs are counted from the
    * catches themselves. The profile endpoint carries no total, and its gallery
    * is drawn from the eight newest catches only, so a photograph on an older
    * fish never reaches it.
    * TODO(api): totals and a photographed-only gallery on the profile payload
    * so this second call can go (appendix E, the profile figures item). */
   useEffect(() => {
      const controller = new AbortController();

      fetchMyCatches(controller.signal)
         .then((list) => {
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
            const first = list.reduce<string | null>(
               (earliest, entry) =>
                  !earliest || entry.caughtAt < earliest
                     ? entry.caughtAt
                     : earliest,
               null
            );

            setTallies({
               catches: list.length,
               spots: spots.size,
               bestLengthCm: best?.length ?? null,
               bestCatchId: best?.id ?? null,
               bestCatchTitle: best?.title ?? null,
               firstCaughtAt: first,
            });
            setPhotographs(photographsFrom(list));
         })
         .catch((error: unknown) => {
            if (axios.isCancel(error)) {
               return;
            }

            /* The figures are a nicety; the profile still reads without them. */
            console.error(error);
            setTallies(null);
            setPhotographs(null);
         });

      return () => controller.abort();
   }, [attempt]);

   /* The angler's own photographs first, then anything the server found on a
    * spot, and never the same picture twice. */
   const gallery = useMemo(() => {
      const fromCatches = photographs ?? [];
      const held = new Set(fromCatches.map((entry) => entry.id));
      const fromProfile = (profile?.galleryImages ?? []).filter(
         (entry) => !held.has(entry.id)
      );

      return [...fromCatches, ...fromProfile].slice(0, 12);
   }, [photographs, profile]);

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

   /* The header's circle is the same photograph, so a save moves both. */
   const onSaved = useCallback((saved: UserProfile) => {
      setProfile(saved);
      settleMyAvatar(saved.avatarThumbUrl ?? saved.avatarUrl ?? null);
   }, []);

   return (
      <section className="mx-auto w-[min(1320px,100%-32px)] py-10 md:py-14">
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
               <ProfileView
                  profile={profile}
                  tallies={tallies}
                  gallery={gallery}
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

               {/*
                * Not folded away with the profile settings: these are about
                * the phone or the computer this is open on, not about the
                * angler, and the way onto a home screen has to be findable
                * by somebody who has never opened a settings panel.
                */}
               <div className="mt-12 border-t border-line pt-6">
                  <h2 className="g text-[30px] md:text-[36px]">This device</h2>
                  <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">
                     Hear about follows, replies and likes with Fisherfeed
                     closed, and put it on your home screen.
                  </p>
                  <DeviceSettings className="mt-6 max-w-[640px]" />
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
