import axios from 'axios';
import { useEffect, useState } from 'react';
import type { ProfileResponse, UserProfile } from '@/components/profile/types';

/*
 * Your own photograph, signed, for the header.
 *
 * The session carries the raw storage key of the avatar, which is not a
 * picture anyone can load. The profile route signs it. Read once per visit
 * and shared, so the header does not ask on every page.
 *
 * The thumb, never the original. This is a forty four pixel circle drawn on
 * every page of the app, and it was loading whatever came out of the camera:
 * one four megabyte photograph, on every route, before anything else on the
 * screen could have it. The full size copy is still taken when there is no
 * thumb yet, which is only true of an avatar uploaded before the variants.
 */
let cached: string | null | undefined;
let loading: Promise<UserProfile | null> | null = null;
const listeners = new Set<() => void>();

export function settleMyAvatar(url: string | null) {
   cached = url;
   listeners.forEach((fn) => fn());
}

export function forgetMyAvatar() {
   cached = undefined;
   loading = null;
   listeners.forEach((fn) => fn());
}

/*
 * One read of the signed-in angler per load, shared.
 *
 * The header circle and the profile screen want the same person, and on a cold
 * /profile they both asked for it in the same second: two calls to
 * /api/users/me on one page, which is how the rate limiter started answering
 * 429. Whoever asks first makes the call and everyone else waits on it. The
 * promise is dropped once it settles, so a retry is a fresh read.
 */
export function fetchMyProfile(): Promise<UserProfile | null> {
   loading ??= axios
      .get<ProfileResponse>('/api/users/me')
      .then(({ data }) => {
         const profile = data.profile ?? null;
         settleMyAvatar(profile?.avatarThumbUrl ?? profile?.avatarUrl ?? null);
         return profile;
      })
      .finally(() => {
         loading = null;
      });

   return loading;
}

export function useMyAvatar(enabled = true) {
   const [, bump] = useState(0);
   useEffect(() => {
      const fn = () => bump((n) => n + 1);
      listeners.add(fn);
      return () => {
         listeners.delete(fn);
      };
   }, []);
   useEffect(() => {
      if (!enabled || cached !== undefined) return;
      void fetchMyProfile().catch(() => settleMyAvatar(null));
   }, [enabled]);
   return cached ?? null;
}
