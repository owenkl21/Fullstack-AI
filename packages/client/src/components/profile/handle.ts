import axios from 'axios';
import { useEffect, useState } from 'react';

/*
 * What a handle is, said once for the two places that ask for one: the step
 * after signing in and the profile settings. The server holds the same rules
 * and has the last word; these only let the field answer before it is asked.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 40;

const CHECK_DEBOUNCE_MS = 300;

/**
 * Normalised as it is typed, so what the field shows is what gets saved. The
 * server does the same, so "@Owen" pasted in becomes owen either way.
 */
export const normaliseHandle = (raw: string) =>
   raw.trim().replace(/^@/, '').trim().toLowerCase();

type LocalProblem = 'short' | 'long' | 'chars';

const localProblemOf = (handle: string): LocalProblem | null => {
   if (handle.length < HANDLE_MIN) return 'short';
   if (handle.length > HANDLE_MAX) return 'long';
   return /^[a-z0-9_]+$/.test(handle) ? null : 'chars';
};

export type HandleCheck =
   | { kind: 'empty' }
   | { kind: 'problem'; problem: LocalProblem }
   | { kind: 'own'; handle: string }
   | { kind: 'checking'; handle: string }
   | { kind: 'free'; handle: string }
   | { kind: 'taken'; handle: string }
   | { kind: 'reserved'; handle: string }
   /* The check itself failed. Saving is still allowed: the server decides. */
   | { kind: 'unknown'; handle: string };

type Answer = {
   available: boolean;
   reason?: 'taken' | 'reserved' | 'invalid';
   normalised: string;
};

/**
 * Whether a normalised handle is free, asked once the typing stops.
 *
 * The answer is kept beside the handle it was for, so a slow reply about an
 * earlier spelling is never shown under the current one. The angler's own
 * handle is theirs and is never asked about.
 */
export function useHandleCheck(
   handle: string,
   current: string | null | undefined
): HandleCheck {
   const [answer, setAnswer] = useState<{
      handle: string;
      kind: 'free' | 'taken' | 'reserved' | 'unknown' | 'chars';
   } | null>(null);

   const problem = handle ? localProblemOf(handle) : null;
   /* Lowercased, because a handle saved before handles were lowercased is
    * still this angler's own. */
   const own = typeof current === 'string' && current.toLowerCase() === handle;
   const ask = Boolean(handle) && !problem && !own;

   useEffect(() => {
      if (!ask) return;

      const controller = new AbortController();
      const timer = window.setTimeout(() => {
         axios
            .get<Answer>('/api/users/handle-available', {
               params: { handle },
               signal: controller.signal,
            })
            .then(({ data }) => {
               setAnswer({
                  handle,
                  kind: data.available
                     ? 'free'
                     : data.reason === 'invalid'
                       ? 'chars'
                       : (data.reason ?? 'taken'),
               });
            })
            .catch((error: unknown) => {
               if (axios.isCancel(error)) return;
               setAnswer({ handle, kind: 'unknown' });
            });
      }, CHECK_DEBOUNCE_MS);

      return () => {
         window.clearTimeout(timer);
         controller.abort();
      };
   }, [ask, handle]);

   if (!handle) return { kind: 'empty' };
   if (problem) return { kind: 'problem', problem };
   if (own) return { kind: 'own', handle };
   if (answer?.handle !== handle) return { kind: 'checking', handle };
   if (answer.kind === 'chars') return { kind: 'problem', problem: 'chars' };
   return { kind: answer.kind, handle };
}

/** A check that saving should not go past. */
export const blocksSave = (check: HandleCheck) =>
   check.kind === 'empty' ||
   check.kind === 'problem' ||
   check.kind === 'taken' ||
   check.kind === 'reserved';

export const TAKEN = 'That handle is already taken. Try another one.';
export const RESERVED = 'That handle is reserved. Try another one.';
export const NOT_VALID =
   'A handle can use letters, numbers and underscores only.';

/**
 * What to say under the field. A handle that is merely too short so far is
 * not an error while it is still being typed, only once the field is left.
 */
export function describeHandle(
   check: HandleCheck,
   finished: boolean
): { tone: 'quiet' | 'good' | 'bad'; text: string } {
   const rules = `Lowercase letters, numbers and underscores, ${HANDLE_MIN} to ${HANDLE_MAX} characters.`;

   switch (check.kind) {
      case 'empty':
         return finished
            ? { tone: 'bad', text: 'Pick a handle to carry on.' }
            : { tone: 'quiet', text: rules };
      case 'problem':
         if (check.problem === 'short') {
            return finished
               ? {
                    tone: 'bad',
                    text: `A handle needs at least ${HANDLE_MIN} characters.`,
                 }
               : { tone: 'quiet', text: rules };
         }
         return check.problem === 'long'
            ? {
                 tone: 'bad',
                 text: `A handle can be ${HANDLE_MAX} characters at most.`,
              }
            : { tone: 'bad', text: NOT_VALID };
      case 'own':
         return { tone: 'quiet', text: `@${check.handle} is your handle now.` };
      case 'checking':
         return { tone: 'quiet', text: `Checking @${check.handle}.` };
      case 'free':
         return { tone: 'good', text: `@${check.handle} is free.` };
      case 'taken':
         return { tone: 'bad', text: TAKEN };
      case 'reserved':
         return { tone: 'bad', text: RESERVED };
      case 'unknown':
         return {
            tone: 'quiet',
            text: 'Could not check that handle just now. You can still save it.',
         };
   }
}

/** The sentence for a save the server refused, from its status and code. */
export function handleSaveProblem(error: unknown): string | null {
   if (!axios.isAxiosError(error)) return null;

   const status = error.response?.status;
   const data = error.response?.data as
      | { code?: string; username?: unknown }
      | undefined;

   if (status === 409) return TAKEN;
   if (status === 400 && data?.code === 'username_reserved') return RESERVED;
   /* The schema's own refusal, keyed by field. */
   if (status === 400 && data?.username) return NOT_VALID;
   return null;
}
