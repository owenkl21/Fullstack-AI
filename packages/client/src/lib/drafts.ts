import { useEffect, useState } from 'react';

/*
 * A catch half written.
 *
 * Kept in this browser, not on the server: a draft is a private thing and
 * the log is only ever a tap away. Each form knows how to fold its own state
 * into one and open it again. The list is small, so it is read whole.
 */

export type DraftKind = 'quick' | 'full';

export type Draft = {
   id: string;
   kind: DraftKind;
   title: string;
   savedAt: string;
   state: Record<string, unknown>;
};

const KEY = 'fishlogger.drafts';
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

const read = (): Draft[] => {
   try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? (JSON.parse(raw) as Draft[]) : [];
      return Array.isArray(list) ? list : [];
   } catch {
      return [];
   }
};

const write = (list: Draft[]) => {
   try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
   } catch {
      /* storage may be full or off; the draft simply is not kept */
   }
   announce();
};

export const listDrafts = () =>
   read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));

export const readDraft = (id: string) =>
   read().find((draft) => draft.id === id) ?? null;

export function saveDraft(
   kind: DraftKind,
   title: string,
   state: Record<string, unknown>,
   id?: string | null
): Draft {
   const list = read();
   const draft: Draft = {
      id:
         id ??
         `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind,
      title: title.trim() || 'Untitled catch',
      savedAt: new Date().toISOString(),
      state,
   };
   write([draft, ...list.filter((d) => d.id !== draft.id)]);
   return draft;
}

export function removeDraft(id: string) {
   write(read().filter((draft) => draft.id !== id));
}

export function useDrafts() {
   const [drafts, setDrafts] = useState<Draft[]>(() => listDrafts());
   useEffect(() => {
      const fn = () => setDrafts(listDrafts());
      listeners.add(fn);
      window.addEventListener('storage', fn);
      return () => {
         listeners.delete(fn);
         window.removeEventListener('storage', fn);
      };
   }, []);
   return drafts;
}
