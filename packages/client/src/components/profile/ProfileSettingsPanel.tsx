import axios from 'axios';
import { useClerk, useUser } from '@clerk/react';
import { CalendarDays, Database, UserCircle2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { FishingBobberLoader } from '@/components/ui/fishing-bobber-loader';
import { toast } from '@/components/ui/use-toast';

type UserProfile = {
   id: string;
   displayName: string;
   username: string;
   bio: string | null;
   email: string;
   avatarUrl: string | null;
   followersCount: number;
   followingCount: number;
   galleryImages: Array<{
      id: string;
      url: string;
      sourceType: 'CATCH' | 'SITE';
      sourceId: string;
      sourceTitle: string;
   }>;
   createdAt: string;
   updatedAt: string;
};

type ProfileResponse = {
   profile: UserProfile;
   storage?: 'database' | 'clerk_fallback';
};

type ConnectionUser = {
   id: string;
   username: string;
   displayName: string;
   avatarUrl: string | null;
};

const extractStorageKey = (value: string | null | undefined) => {
   if (!value) {
      return null;
   }

   if (value.startsWith('users/')) {
      return value;
   }

   try {
      const parsed = new URL(value);
      const normalizedPath = parsed.pathname.replace(/^\/+/, '');
      const userSegmentIndex = normalizedPath.indexOf('users/');

      if (userSegmentIndex >= 0) {
         return normalizedPath.slice(userSegmentIndex);
      }
   } catch {
      return null;
   }

   return null;
};

const formatDate = (value: string) => {
   const date = new Date(value);

   if (Number.isNaN(date.getTime())) {
      return 'Unavailable';
   }

   return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
   }).format(date);
};

export function ProfileSettingsPanel() {
   const { user } = useUser();
   const clerk = useClerk();
   const navigate = useNavigate();

   const [profile, setProfile] = useState<UserProfile | null>(null);
   const [displayName, setDisplayName] = useState('');
   const [username, setUsername] = useState('');
   const [bio, setBio] = useState('');
   const [avatarImages, setAvatarImages] = useState<
      { storageKey: string; url: string }[]
   >([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [connectionsDialog, setConnectionsDialog] = useState<
      'followers' | 'following' | null
   >(null);
   const [connectionsSearch, setConnectionsSearch] = useState('');
   const [connections, setConnections] = useState<ConnectionUser[]>([]);
   const [isConnectionsLoading, setIsConnectionsLoading] = useState(false);

   useEffect(() => {
      const loadProfile = async () => {
         try {
            setIsLoading(true);
            const { data } = await axios.get<ProfileResponse>('/api/users/me');
            setProfile(data.profile);
            setDisplayName(data.profile.displayName ?? '');
            setUsername(data.profile.username ?? '');
            setBio(data.profile.bio ?? '');
            setAvatarImages(
               data.profile.avatarUrl
                  ? [
                       {
                          storageKey:
                             extractStorageKey(data.profile.avatarUrl) ??
                             data.profile.avatarUrl,
                          url: data.profile.avatarUrl,
                       },
                    ]
                  : []
            );
         } catch (error) {
            console.error(error);
            toast({
               title: 'Could not load your profile',
               description:
                  'Make sure you are signed in and try refreshing the page.',
               variant: 'error',
            });
         } finally {
            setIsLoading(false);
         }
      };

      void loadProfile();
   }, []);

   useEffect(() => {
      const loadConnections = async () => {
         if (!connectionsDialog) {
            return;
         }

         try {
            setIsConnectionsLoading(true);
            const { data } = await axios.get<{ users: ConnectionUser[] }>(
               '/api/users/me/connections',
               {
                  params: {
                     type: connectionsDialog,
                     search: connectionsSearch.trim(),
                  },
               }
            );
            setConnections(data.users ?? []);
         } catch (error) {
            console.error(error);
            toast({
               title: 'Unable to load connections',
               description: 'Please try again.',
               variant: 'error',
            });
         } finally {
            setIsConnectionsLoading(false);
         }
      };

      void loadConnections();
   }, [connectionsDialog, connectionsSearch]);

   const connectionsTitle = useMemo(() => {
      if (connectionsDialog === 'followers') {
         return 'Followers';
      }
      if (connectionsDialog === 'following') {
         return 'Following';
      }
      return '';
   }, [connectionsDialog]);

   const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
         setIsSaving(true);

         const payload = {
            displayName: displayName.trim(),
            username: username.trim(),
            bio: bio.trim() ? bio.trim() : null,
            avatarUrl: avatarImages[0]?.storageKey ?? null,
         };

         const { data } = await axios.patch<ProfileResponse>(
            '/api/users/me',
            payload
         );

         setProfile(data.profile);
         setDisplayName(data.profile.displayName ?? '');
         setUsername(data.profile.username ?? '');
         setBio(data.profile.bio ?? '');
         setAvatarImages(
            data.profile.avatarUrl
               ? [
                    {
                       storageKey:
                          payload.avatarUrl ??
                          extractStorageKey(data.profile.avatarUrl) ??
                          data.profile.avatarUrl,
                       url: data.profile.avatarUrl,
                    },
                 ]
               : []
         );

         toast({
            title:
               data.storage === 'clerk_fallback'
                  ? 'Saved to Clerk fallback profile'
                  : 'Profile saved to database',
            description:
               data.storage === 'clerk_fallback'
                  ? 'Database is unavailable, so your profile was saved to Clerk metadata.'
                  : 'Your profile details were updated successfully.',
            variant: 'success',
         });

         navigate('/', { replace: true });
      } catch (error) {
         console.error(error);
         toast({
            title: 'Unable to save profile',
            description: 'Please review your values and retry.',
            variant: 'error',
         });
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <section id="profile" className="mx-auto w-full max-w-5xl py-2">
         <Card className="p-6 sm:p-8">
            <div className="mb-6 flex flex-col gap-2">
               <h1 className="text-2xl font-semibold tracking-tight">
                  Profile settings
               </h1>
               <p className="text-sm text-muted-foreground">
                  Manage the account fields saved in your app database.
               </p>
            </div>

            {isLoading ? (
               <FishingBobberLoader label="Loading your profile..." />
            ) : (
               <div className="space-y-6">
                  <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-3">
                     <div className="sm:col-span-1">
                        {profile?.avatarUrl ? (
                           <img
                              src={profile.avatarUrl}
                              alt="Profile avatar"
                              className="size-16 rounded-full border border-border object-cover"
                           />
                        ) : (
                           <span className="inline-flex size-16 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                              <UserCircle2 className="size-8" />
                           </span>
                        )}
                     </div>

                     <div className="space-y-2 sm:col-span-2">
                        <p className="text-sm">
                           Signed in as{' '}
                           <span className="font-medium">
                              {profile?.email ??
                                 user?.primaryEmailAddress?.emailAddress}
                           </span>
                        </p>
                        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                           <p className="inline-flex items-center gap-2">
                              <Database className="size-3.5" />
                              User ID: {profile?.id ?? 'Unavailable'}
                           </p>
                           <p className="inline-flex items-center gap-2">
                              <CalendarDays className="size-3.5" />
                              Joined:{' '}
                              {profile
                                 ? formatDate(profile.createdAt)
                                 : 'Unavailable'}
                           </p>
                           <p className="inline-flex items-center gap-2 sm:col-span-2">
                              Last profile update:{' '}
                              {profile
                                 ? formatDate(profile.updatedAt)
                                 : 'Unavailable'}
                           </p>
                        </div>
                     </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                     <button
                        type="button"
                        className="rounded-lg border border-border bg-background p-4 text-left"
                        onClick={() => {
                           setConnectionsSearch('');
                           setConnectionsDialog('followers');
                        }}
                     >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                           Followers
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                           {profile?.followersCount ?? 0}
                        </p>
                     </button>
                     <button
                        type="button"
                        className="rounded-lg border border-border bg-background p-4 text-left"
                        onClick={() => {
                           setConnectionsSearch('');
                           setConnectionsDialog('following');
                        }}
                     >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                           Following
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                           {profile?.followingCount ?? 0}
                        </p>
                     </button>
                  </div>

                  <div className="space-y-3">
                     <h2 className="text-lg font-semibold tracking-tight">
                        Your catches & site images
                     </h2>
                     {profile && profile.galleryImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                           {profile.galleryImages.map((entry) => (
                              <div
                                 key={`${entry.sourceType}-${entry.sourceId}-${entry.id}`}
                                 className="group relative overflow-hidden rounded-md border border-border bg-muted"
                              >
                                 <img
                                    src={entry.url}
                                    alt={entry.sourceTitle}
                                    className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    loading="lazy"
                                 />
                                 <span className="absolute bottom-2 left-2 rounded bg-background/85 px-2 py-0.5 text-[10px] font-medium">
                                    {entry.sourceType}
                                 </span>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <p className="text-sm text-muted-foreground">
                           Add catches or sites with images to build your
                           gallery.
                        </p>
                     )}
                  </div>

                  <form className="space-y-4" onSubmit={saveProfile}>
                     <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm">
                           Display name
                           <input
                              className="rounded-md border border-border bg-background px-3 py-2"
                              value={displayName}
                              onChange={(event) =>
                                 setDisplayName(event.target.value)
                              }
                              minLength={2}
                              maxLength={80}
                              required
                           />
                        </label>

                        <label className="flex flex-col gap-2 text-sm">
                           Username
                           <input
                              className="rounded-md border border-border bg-background px-3 py-2"
                              value={username}
                              onChange={(event) =>
                                 setUsername(event.target.value)
                              }
                              minLength={3}
                              maxLength={40}
                              pattern="[a-zA-Z0-9_]+"
                              required
                           />
                        </label>
                     </div>

                     <label className="flex flex-col gap-2 text-sm">
                        Bio
                        <textarea
                           className="min-h-24 rounded-md border border-border bg-background px-3 py-2"
                           value={bio}
                           onChange={(event) => setBio(event.target.value)}
                           maxLength={280}
                        />
                     </label>

                     <R2ImagePicker
                        scope="avatar"
                        label="Avatar image"
                        multiple={false}
                        maxItems={1}
                        value={avatarImages}
                        onChange={setAvatarImages}
                     />

                     <p className="text-xs text-muted-foreground">
                        Editable fields: display name, username, bio, and avatar
                        image.
                     </p>

                     <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Button type="submit" disabled={isSaving}>
                           {isSaving ? 'Saving...' : 'Save app profile'}
                        </Button>
                        <Button
                           type="button"
                           variant="outline"
                           onClick={() => clerk.openUserProfile()}
                        >
                           Manage account / delete in Clerk
                        </Button>
                     </div>
                  </form>
               </div>
            )}

            <Dialog
               open={Boolean(connectionsDialog)}
               onOpenChange={(open) => {
                  if (!open) {
                     setConnectionsDialog(null);
                  }
               }}
            >
               <DialogContent>
                  <DialogHeader>
                     <DialogTitle>{connectionsTitle}</DialogTitle>
                     <DialogDescription>
                        Browse and search your {connectionsTitle.toLowerCase()}{' '}
                        list.
                     </DialogDescription>
                  </DialogHeader>
                  <input
                     type="text"
                     value={connectionsSearch}
                     onChange={(event) =>
                        setConnectionsSearch(event.target.value)
                     }
                     placeholder="Search by name or username"
                     className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                     {isConnectionsLoading ? (
                        <p className="text-sm text-muted-foreground">
                           Loading...
                        </p>
                     ) : connections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                           No users found.
                        </p>
                     ) : (
                        connections.map((entry) => (
                           <div
                              key={entry.id}
                              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                           >
                              {entry.avatarUrl ? (
                                 <img
                                    src={entry.avatarUrl}
                                    alt={entry.displayName}
                                    className="size-10 rounded-full object-cover"
                                 />
                              ) : (
                                 <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                                    <UserCircle2 className="size-5" />
                                 </span>
                              )}
                              <div className="min-w-0">
                                 <p className="truncate text-sm font-medium">
                                    {entry.displayName}
                                 </p>
                                 <p className="truncate text-xs text-muted-foreground">
                                    @{entry.username}
                                 </p>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </DialogContent>
            </Dialog>
         </Card>
      </section>
   );
}
