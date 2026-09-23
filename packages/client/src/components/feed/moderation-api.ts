import axios from 'axios';

/*
 * Reports and the team's removals, as the server takes them. The sheet and
 * the dialog that use these are in moderation.tsx.
 */

export type ReportKind = 'post' | 'comment';

export type ReportReason = 'SPAM' | 'ABUSE' | 'LANGUAGE' | 'IMAGE' | 'OTHER';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
   { value: 'ABUSE', label: 'Abuse or bullying' },
   { value: 'LANGUAGE', label: 'Bad language' },
   { value: 'IMAGE', label: 'A photo that should not be here' },
   { value: 'SPAM', label: 'Spam or selling' },
   { value: 'OTHER', label: 'Something else' },
];

export const REASON_WORDS: Record<ReportReason, string> = {
   ABUSE: 'Abuse',
   LANGUAGE: 'Language',
   IMAGE: 'Photo',
   SPAM: 'Spam',
   OTHER: 'Other',
};

export async function reportContent(
   kind: ReportKind,
   id: string,
   reason: ReportReason,
   note: string | null
) {
   const path =
      kind === 'post'
         ? `/api/feed/${id}/report`
         : `/api/feed/comments/${id}/report`;
   const { data } = await axios.post<{
      status: 'reported' | 'already' | 'own';
      hidden: boolean;
      message: string;
   }>(path, { reason, note });
   return data;
}

/* The team's removal. Only the admin guard's routes answer it. */
export async function removeAsTeam(kind: ReportKind, id: string) {
   const { data } = await axios.delete<{
      removed: boolean | number;
      removedIds?: string[];
      commentCount?: number | null;
   }>(`/api/admin/moderation/${kind === 'post' ? 'posts' : 'comments'}/${id}`);
   return data;
}

/*
 * What the server said when it turned a piece of writing away. A word that
 * is not allowed comes back inside zod's formatted errors, in the field it was
 * found in; anything else has a message of its own or none.
 */
export function refusalWords(error: unknown): string | null {
   if (!axios.isAxiosError(error) || error.response?.status !== 400)
      return null;
   const found: string[] = [];
   const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, inner] of Object.entries(value)) {
         if (key === '_errors' && Array.isArray(inner)) {
            for (const text of inner)
               if (typeof text === 'string') found.push(text);
         } else if (key === 'message' && typeof inner === 'string') {
            found.push(inner);
         } else walk(inner);
      }
   };
   walk(error.response?.data);
   return found[0] ?? null;
}
