import axios from 'axios';
import { useEffect, useState } from 'react';

/*
 * Keeping somebody else's spot or gear.
 *
 * A reference, never a copy: what the owner does with it afterwards still
 * applies, so a spot they make private drops out of your list on its own.
 */

export type SavedSpot = {
   id: string;
   note: string | null;
   savedAt: string;
   site: {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      waterType: string | null;
      ownerId: string | null;
      ownerName: string | null;
   };
};

export type SavedGear = {
   id: string;
   savedAt: string;
   gear: {
      id: string;
      name: string;
      brand: string | null;
      type: string;
      imageUrl: string | null;
      ownerName: string | null;
   };
};

export type SavedPostRow = {
   id: string;
   savedAt: string;
   post: {
      id: string;
      type: 'CATCH' | 'SITE' | string;
      content: string | null;
      createdAt: string;
      author: { id: string; displayName: string; username: string };
      catch: {
         id: string;
         title: string;
         caughtAt: string;
         length: number | null;
         weight: number | null;
         species: { commonName: string } | null;
         site: { id: string; name: string } | null;
      } | null;
      site: { id: string; name: string } | null;
   };
};

export async function listSavedPosts(signal?: AbortSignal) {
   const { data } = await axios.get<{ posts: SavedPostRow[] }>(
      '/api/saved/posts',
      { signal }
   );
   return data.posts ?? [];
}

export const savePost = (postId: string) =>
   axios.post(`/api/saved/posts/${postId}`, {});
export const removePost = (postId: string) =>
   axios.delete(`/api/saved/posts/${postId}`);

export async function listSavedSpots(signal?: AbortSignal) {
   const { data } = await axios.get<{ spots: SavedSpot[] }>(
      '/api/saved/spots',
      { signal }
   );
   return data.spots ?? [];
}

export async function listSavedGear(signal?: AbortSignal) {
   const { data } = await axios.get<{ gear: SavedGear[] }>('/api/saved/gear', {
      signal,
   });
   return data.gear ?? [];
}

export const saveSpot = (siteId: string) =>
   axios.post(`/api/saved/spots/${siteId}`, {});
export const removeSpot = (siteId: string) =>
   axios.delete(`/api/saved/spots/${siteId}`);
export const saveGear = (gearId: string) =>
   axios.post(`/api/saved/gear/${gearId}`, {});
export const removeGear = (gearId: string) =>
   axios.delete(`/api/saved/gear/${gearId}`);

/*
 * Which ids you have kept, shared by every page that shows a keep button.
 *
 * Loaded once per visit and held in the module, so a spot page, the map and a
 * catch page all agree without each fetching the two lists. A keep or a
 * removal updates it in place and tells every mounted page.
 */
type Kept = { spots: Set<string>; gear: Set<string> };

const NONE: ReadonlySet<string> = new Set();
let kept: Kept | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

export function markKept(kind: 'spot' | 'gear', id: string, isKept: boolean) {
   if (!kept) kept = { spots: new Set(), gear: new Set() };
   const set = kind === 'spot' ? kept.spots : kept.gear;
   if (isKept) set.add(id);
   else set.delete(id);
   announce();
}

/** For a sign out: the next person is not the last one. */
export function forgetKept() {
   kept = null;
   announce();
}

export function useKept(enabled = true) {
   const [, bump] = useState(0);

   useEffect(() => {
      const fn = () => bump((n) => n + 1);
      listeners.add(fn);
      return () => {
         listeners.delete(fn);
      };
   }, []);

   useEffect(() => {
      if (!enabled || kept || loading) return;
      loading = Promise.all([listSavedSpots(), listSavedGear()])
         .then(([spots, gear]) => {
            kept = {
               spots: new Set(spots.map((row) => row.site.id)),
               gear: new Set(gear.map((row) => row.gear.id)),
            };
            announce();
         })
         .catch(() => undefined)
         .finally(() => {
            loading = null;
         });
   }, [enabled]);

   return {
      spots: kept?.spots ?? NONE,
      gear: kept?.gear ?? NONE,
      ready: kept !== null,
   };
}
