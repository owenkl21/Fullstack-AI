import axios from 'axios';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import type { ProfileResponse, UserProfile } from '@/components/profile/types';
import { HandleField } from '@/components/profile/HandleField';
import {
   blocksSave,
   handleSaveProblem,
   normaliseHandle,
   useHandleCheck,
} from '@/components/profile/handle';
import { useSession } from '@/lib/auth-client';
import { Link } from 'react-router-dom';
import {
   FieldRow,
   FieldStack,
   TextArea,
   TextField,
} from '@/components/ui/field';

/*
 * The four things an angler can change about themselves. Labels above dashed
 * teal underlines, the rules written out in words beside a live counter, and
 * anything the server refuses said beside the field that caused it. Saving keeps
 * you on your profile and says what was saved.
 */

const NAME_MAX = 80;
const BIO_MAX = 280;

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

const avatarValueOf = (profile: UserProfile) =>
   profile.avatarUrl
      ? [
           {
              storageKey:
                 extractStorageKey(profile.avatarUrl) ?? profile.avatarUrl,
              url: profile.avatarUrl,
           },
        ]
      : [];

const bannerValueOf = (profile: UserProfile) =>
   profile.bannerUrl
      ? [
           {
              storageKey:
                 extractStorageKey(profile.bannerUrl) ?? profile.bannerUrl,
              url: profile.bannerUrl,
           },
        ]
      : [];

const nameProblem = (value: string) => {
   const trimmed = value.trim();

   if (trimmed.length < 2) {
      return 'Your name needs at least 2 characters.';
   }

   if (trimmed.length > NAME_MAX) {
      return `Your name can be ${NAME_MAX} characters at most.`;
   }

   return '';
};

const bioProblem = (value: string) =>
   value.trim().length > BIO_MAX
      ? `Your bio can be ${BIO_MAX} characters at most.`
      : '';

export function ProfileSettingsPanel({
   profile,
   onSaved,
}: {
   profile: UserProfile;
   onSaved: (profile: UserProfile) => void;
}) {
   const nameRef = useRef<HTMLInputElement>(null);
   const handleRef = useRef<HTMLInputElement>(null);
   const bioRef = useRef<HTMLTextAreaElement>(null);

   /* The session's copy of the handle is what the header shows, so a save
    * refreshes it rather than leaving the old handle in the account panel. */
   const { refetch: refetchSession } = useSession();

   const [displayName, setDisplayName] = useState(profile.displayName ?? '');
   /* Normalised from the start, so a handle stored before handles were
    * lowercased shows as what it will be saved as, not as a fault. */
   const [username, setUsername] = useState(
      normaliseHandle(profile.username ?? '')
   );
   const [bio, setBio] = useState(profile.bio ?? '');
   const [avatarImages, setAvatarImages] = useState(avatarValueOf(profile));
   const [bannerImages, setBannerImages] = useState(bannerValueOf(profile));

   const [nameError, setNameError] = useState('');
   const [handleLeft, setHandleLeft] = useState(false);
   const [handleServerError, setHandleServerError] = useState('');
   const [bioError, setBioError] = useState('');
   const [saveError, setSaveError] = useState('');

   const [isSaving, setIsSaving] = useState(false);
   const [isUploading, setIsUploading] = useState(false);

   const handleCheck = useHandleCheck(username, profile.username);

   /* A save elsewhere on the page rewrites the person, so the fields follow it. */
   useEffect(() => {
      setDisplayName(profile.displayName ?? '');
      setUsername(normaliseHandle(profile.username ?? ''));
      setBio(profile.bio ?? '');
      setAvatarImages(avatarValueOf(profile));
      setBannerImages(bannerValueOf(profile));
   }, [profile]);

   const save = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const problems = {
         name: nameProblem(displayName),
         handle: blocksSave(handleCheck),
         bio: bioProblem(bio),
      };

      setNameError(problems.name);
      setHandleLeft(true);
      setBioError(problems.bio);
      setSaveError('');

      if (problems.name) {
         nameRef.current?.focus();
         return;
      }

      if (problems.handle) {
         handleRef.current?.focus();
         return;
      }

      if (problems.bio) {
         bioRef.current?.focus();
         return;
      }

      try {
         setIsSaving(true);

         const trimmedBio = bio.trim();
         const { data } = await axios.patch<ProfileResponse>('/api/users/me', {
            displayName: displayName.trim(),
            username,
            bio: trimmedBio ? trimmedBio : null,
            avatarUrl: avatarImages[0]?.storageKey ?? null,
            bannerUrl: bannerImages[0]?.storageKey ?? null,
         });

         onSaved(data.profile);
         void refetchSession();

         toast({
            title: 'Profile saved.',
            description: `${data.profile.displayName}, @${data.profile.username}.`,
            variant: 'success',
         });
      } catch (error) {
         console.error(error);

         /* Taken since the field last checked, or refused outright. Said
          * beside the handle, never swapped for another one. */
         const handleRefusal = handleSaveProblem(error);
         if (handleRefusal) {
            setHandleServerError(handleRefusal);
            handleRef.current?.focus();
            return;
         }

         if (axios.isAxiosError(error) && error.response?.status === 400) {
            setSaveError(
               'Not saved. Check the three fields above and try again.'
            );
            return;
         }

         setSaveError('Not saved. Check your connection and try again.');
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <form className="mt-6 max-w-[680px]" onSubmit={save} noValidate>
         <FieldStack>
            <FieldRow>
               <TextField
                  label="Display name"
                  ref={nameRef}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  onBlur={() => setNameError(nameProblem(displayName))}
                  error={nameError}
                  hint={`The name other anglers see. ${displayName.trim().length} of ${NAME_MAX} characters used.`}
               />

               {/*
                * The @ is part of the field rather than a label beside it, so
                * the handle lines up with the display name next to it. It used
                * to be a separate bordered row, which put the two controls on
                * different baselines and at different heights.
                */}
               <HandleField
                  ref={handleRef}
                  value={username}
                  onChange={(next) => {
                     setUsername(next);
                     setHandleServerError('');
                  }}
                  onBlur={() => setHandleLeft(true)}
                  check={handleCheck}
                  finished={handleLeft}
                  serverError={handleServerError}
               />
            </FieldRow>

            <TextArea
               label="Bio"
               ref={bioRef}
               value={bio}
               onChange={(event) => setBio(event.target.value)}
               onBlur={() => setBioError(bioProblem(bio))}
               rows={4}
               error={bioError}
               hint={`A line or two about how you fish. ${bio.trim().length} of ${BIO_MAX} characters used.`}
            />
         </FieldStack>

         <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
               <span className="lab">Your photograph</span>
               <p className="mt-1 min-h-[42px] text-[14px] text-ink-3">
                  Round, small, beside your name everywhere.
               </p>
               <div className="mt-2 max-w-[420px]">
                  <R2ImagePicker
                     scope="avatar"
                     label="Your photograph"
                     multiple={false}
                     maxItems={1}
                     value={avatarImages}
                     onChange={setAvatarImages}
                     onUploadingChange={setIsUploading}
                     disabled={isSaving}
                  />
               </div>
            </div>

            <div>
               <span className="lab">Your banner</span>
               <p className="mt-1 min-h-[42px] text-[14px] text-ink-3">
                  Wide, behind your name on your page. A stretch of coast works
                  best.
               </p>
               <div className="mt-2 max-w-[420px]">
                  <R2ImagePicker
                     scope="banner"
                     label="Your banner"
                     multiple={false}
                     maxItems={1}
                     value={bannerImages}
                     onChange={setBannerImages}
                     onUploadingChange={setIsUploading}
                     disabled={isSaving}
                  />
               </div>
            </div>
         </div>

         {saveError ? (
            <p role="alert" className="mt-8 text-sm text-destructive">
               {saveError}
            </p>
         ) : null}

         <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <Button type="submit" size="lg" disabled={isSaving || isUploading}>
               {isSaving ? 'Saving' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" asChild>
               <Link to="/account">Manage your account</Link>
            </Button>
         </div>

         {isUploading ? (
            <p className="mt-3 text-sm text-ink-2">
               The photograph is still going up. Saving waits for it.
            </p>
         ) : null}

         <p className="mt-6 max-w-[68ch] text-sm text-ink-2">
            Your email address, your password and closing your account are
            handled under Manage your account.
         </p>
      </form>
   );
}
