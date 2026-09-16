import { useId, type FormEvent } from 'react';

import { formatStamp, plural } from '@/components/feed/format';
import type { FeedComment } from '@/components/feed/types';
import { Link } from 'react-router-dom';

const COMMENT_LIMIT = 1000;

/*
 * The thread under a post. The composer is a dashed underline with a visible
 * label, Enter sends it, and a reply appears the moment it is written rather
 * than after a round trip.
 */
export function CommentThread({
   id,
   comments,
   commentCount,
   isSignedIn,
   draft,
   onDraftChange,
   onSubmit,
   isSubmitting,
   error,
   onReadAll,
   isReadingAll,
   hasReadAll,
}: {
   id: string;
   comments: FeedComment[];
   commentCount: number;
   isSignedIn: boolean;
   draft: string;
   onDraftChange: (next: string) => void;
   onSubmit: () => void;
   isSubmitting: boolean;
   error: string | null;
   onReadAll: () => void;
   isReadingAll: boolean;
   hasReadAll: boolean;
}) {
   const fieldId = useId();
   const trimmed = draft.trim();
   const remaining = COMMENT_LIMIT - draft.length;
   const hidden = Math.max(commentCount - comments.length, 0);

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!trimmed || isSubmitting) return;
      onSubmit();
   };

   return (
      <div id={id} className="flex flex-col gap-4 pt-1">
         {comments.length > 0 ? (
            <ul className="flex flex-col">
               {comments.map((comment) => {
                  const stamp = formatStamp(comment.createdAt);
                  return (
                     <li
                        key={comment.id}
                        className="flex flex-col gap-1 border-t border-paper/15 py-3 first:border-t-0 first:pt-0"
                     >
                        <p className="flex flex-wrap items-baseline gap-x-3">
                           <span className="text-[15px] font-semibold text-paper">
                              {comment.user.displayName}
                           </span>
                           {stamp ? (
                              <span className="lab text-paper-2">{stamp}</span>
                           ) : null}
                        </p>
                        <p className="text-[15px] leading-relaxed text-paper">
                           {comment.body}
                        </p>
                     </li>
                  );
               })}
            </ul>
         ) : (
            <p className="text-[15px] text-paper-2">No comments yet.</p>
         )}

         {hidden > 0 && !hasReadAll ? (
            <button
               type="button"
               onClick={onReadAll}
               disabled={isReadingAll}
               className="g-tracked inline-flex h-12 items-center self-start text-[19px] text-teal transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
               {isReadingAll
                  ? 'Reading the thread'
                  : `Read all ${plural(commentCount, 'comment', 'comments')}`}
            </button>
         ) : null}

         {isSignedIn ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
               <label htmlFor={fieldId} className="lab text-paper-2">
                  Add a comment
               </label>
               <div className="flex items-end gap-3">
                  <input
                     id={fieldId}
                     type="text"
                     value={draft}
                     maxLength={COMMENT_LIMIT}
                     autoComplete="off"
                     onChange={(event) => onDraftChange(event.target.value)}
                     className="input-line min-h-12 flex-1 text-base text-paper placeholder:text-paper-2"
                     placeholder="Say something useful"
                     aria-describedby={error ? `${fieldId}-error` : undefined}
                     aria-invalid={error ? true : undefined}
                  />
                  <button
                     type="submit"
                     disabled={!trimmed || isSubmitting}
                     className="g-tracked inline-flex h-12 shrink-0 items-center text-[19px] text-teal transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                     {isSubmitting ? 'Sending' : 'Send'}
                  </button>
               </div>
               {remaining <= 100 ? (
                  <p className="lab num text-paper-2">
                     {plural(remaining, 'character', 'characters')} left
                  </p>
               ) : null}
               {error ? (
                  <p id={`${fieldId}-error`} className="text-[15px] text-paper">
                     {error}
                  </p>
               ) : null}
            </form>
         ) : (
            <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-paper-2">
               Sign in to reply.
               <Link
                  to="/sign-in"
                  className="g-tracked inline-flex h-12 items-center text-[19px] text-teal transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
               >
                  Sign in
               </Link>
            </p>
         )}
      </div>
   );
}
