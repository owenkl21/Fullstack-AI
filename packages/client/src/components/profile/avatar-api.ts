import axios from 'axios';
import { useEffect, useState } from 'react';

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
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function settleMyAvatar(url: string | null) {
   cached = url;
   listeners.forEach((fn) => fn());
}

export function forgetMyAvatar() {
   cached = undefined;
   listeners.forEach((fn) => fn());
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
      if (!enabled || cached !== undefined || loading) return;
      loading = axios
         .get<{
            profile?: {
               avatarUrl?: string | null;
               avatarThumbUrl?: string | null;
            };
         }>('/api/users/me')
         .then(({ data }) =>
            settleMyAvatar(
               data.profile?.avatarThumbUrl ?? data.profile?.avatarUrl ?? null
            )
         )
         .catch(() => settleMyAvatar(null))
         .finally(() => {
            loading = null;
         });
   }, [enabled]);
   return cached ?? null;
}
