import axios from 'axios';
import { useClerk, useUser } from '@clerk/react';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type UserProfile = {
   displayName: string;
   username: string;
   bio: string | null;
   email: string;
};

type ProfileResponse = {
   profile: UserProfile;
};

export function ProfileSettingsPanel() {
   const { user } = useUser();
   const clerk = useClerk();

   const [profile, setProfile] = useState<UserProfile | null>(null);
   const [displayName, setDisplayName] = useState('');
   const [username, setUsername] = useState('');
   const [bio, setBio] = useState('');
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [statusMessage, setStatusMessage] = useState('');
   const [errorMessage, setErrorMessage] = useState('');

   useEffect(() => {
      const loadProfile = async () => {
         try {
            setIsLoading(true);
            setErrorMessage('');
            const { data } = await axios.get<ProfileResponse>('/api/users/me');
            setProfile(data.profile);
            setDisplayName(data.profile.displayName ?? '');
            setUsername(data.profile.username ?? '');
            setBio(data.profile.bio ?? '');
         } catch (error) {
            console.error(error);
            setErrorMessage(
               'We could not load your app profile yet. Make sure you are signed in and try again.'
            );
         } finally {
            setIsLoading(false);
         }
      };

      void loadProfile();
   }, []);

   const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
         setIsSaving(true);
         setStatusMessage('');
         setErrorMessage('');

         const payload = {
            displayName: displayName.trim(),
            username: username.trim(),
            bio: bio.trim() ? bio.trim() : null,
         };

         const { data } = await axios.patch<ProfileResponse>(
            '/api/users/me',
            payload
         );

         setProfile(data.profile);
         setDisplayName(data.profile.displayName ?? '');
         setUsername(data.profile.username ?? '');
         setBio(data.profile.bio ?? '');
         setStatusMessage('Profile saved.');
      } catch (error) {
         console.error(error);
         setErrorMessage(
            'Unable to save profile. Please review your values and retry.'
         );
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <section
         id="profile"
         className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8"
      >
         <Card className="p-6 sm:p-8">
            <div className="mb-6 flex flex-col gap-2">
               <h2 className="text-2xl font-semibold tracking-tight">
                  Profile settings
               </h2>
               <p className="text-sm text-muted-foreground">
                  Keep your in-app fishing profile in sync after you
                  authenticate with Clerk.
               </p>
            </div>

            {isLoading ? (
               <p className="text-sm text-muted-foreground">
                  Loading your profile...
               </p>
            ) : (
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
                           onChange={(event) => setUsername(event.target.value)}
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

                  <p className="text-xs text-muted-foreground">
                     Signed in as{' '}
                     <span className="font-medium">
                        {profile?.email ??
                           user?.primaryEmailAddress?.emailAddress}
                     </span>
                  </p>

                  {statusMessage && (
                     <p className="text-sm text-emerald-600">{statusMessage}</p>
                  )}

                  {errorMessage && (
                     <p className="text-sm text-red-600">{errorMessage}</p>
                  )}

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
            )}
         </Card>
      </section>
   );
}
