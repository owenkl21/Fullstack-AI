import axios from 'axios';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { R2ImagePicker } from '@/components/r2-image-picker';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import type { ProfileResponse, UserProfile } from '@/components/profile/types';
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
const HANDLE_MAX = 40;
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

const handleProblem = (value: string) => {
   const trimmed = value.trim();

   if (trimmed.length < 3) {
      return 'A handle needs at least 3 characters.';
   }

   if (trimmed.length > HANDLE_MAX) {
      return `A handle can be ${HANDLE_MAX} characters at most.`;
   }

   if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return 'A handle can use letters, numbers and underscores only.';
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

   const [displayName, setDisplayName] = useState(profile.displayName ?? '');
   const [username, setUsername] = useState(profile.username ?? '');
   const [bio, setBio] = useState(profile.bio ?? '');
   const [avatarImages, setAvatarImages] = useState(avatarValueOf(profile));
   const [bannerImages, setBannerImages] = useState(bannerValueOf(profile));

   const [nameError, setNameError] = useState('');
   const [handleError, setHandleError] = useState('');
   const [bioError, setBioError] = useState('');
   const [saveError, setSaveError] = useState('');

   const [isSaving, setIsSaving] = useState(false);
   const [isUploading, setIsUploading] = useState(false);

   /* A save elsewhere on the page rewrites the person, so the fields follow it. */
   useEffect(() => {
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setBio(profile.bio ?? '');
      setAvatarImages(avatarValueOf(profile));
      setBannerImages(bannerValueOf(profile));
   }, [profile]);

   const save = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const problems = {
         name: nameProblem(displayName),
         handle: handleProblem(username),
         bio: bioProblem(bio),
      };

      setNameError(problems.name);
      setHandleError(problems.handle);
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
            username: username.trim(),
            bio: trimmedBio ? trimmedBio : null,
            avatarUrl: avatarImages[0]?.storageKey ?? null,
            bannerUrl: bannerImages[0]?.storageKey ?? null,
         });

         onSaved(data.profile);

         toast({
            title: 'Profile saved.',
            description: `${data.profile.displayName}, @${data.profile.username}.`,
            variant: 'success',
         });
      } catch (error) {
         console.error(error);

         if (axios.isAxiosError(error) && error.response?.status === 409) {
            setHandleError('That handle is already taken. Try another one.');
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
               <TextField
                  label="Handle"
                  ref={handleRef}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onBlur={() => setHandleError(handleProblem(username))}
                  error={handleError}
                  hint={`Letters, numbers and underscores, 3 to ${HANDLE_MAX} characters, and nobody else can have it.`}
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
