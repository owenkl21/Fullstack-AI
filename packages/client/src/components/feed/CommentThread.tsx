import { useId, useRef, useState, type FormEvent } from 'react';

import { formatAge } from '@/components/feed/format';
import type { FeedComment } from '@/components/feed/types';
import { Link } from 'react-router-dom';

const COMMENT_LIMIT = 1000;
/* Shown at first, and how many more each Read the other N brings. */
const PAGE = 4;

const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

const word =
   'g-tracked inline-flex items-center text-[15px] tracking-[0.07em] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

/*
 * The thread, inside the card, under the action row.
 *
 * Four replies show and Read the other N brings the next four, reading the
 * whole thread from the server the first time it runs out. A reply is a name,
 * how long ago, and what was said: no bubble around it, because the card is
 * already a surface and a surface on a surface is just a box. The composer is
 * one line with the word Post at the end of it, and a reply appears the moment
 * it is written rather than after the round trip.
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
   const box = useRef<HTMLInputElement>(null);
   const trimmed = draft.trim();
   const remaining = COMMENT_LIMIT - draft.length;
   const canSend = Boolean(trimmed) && !isSubmitting;

   /*
    * How many are open to view. Held as a count of comments, so a reply just
    * written (the list grew by one since the last render) is always inside
    * the window: the window follows the list when the list grows by one.
    */
   const [shownCount, setShownCount] = useState(PAGE);
   const [seenLength, setSeenLength] = useState(comments.length);
   let open = shownCount;
   if (comments.length !== seenLength) {
      /* Derived during render, the way React asks: no effect, no extra pass. */
      const grewByOne = comments.length === seenLength + 1;
      setSeenLength(comments.length);
      if (grewByOne) {
         open = Math.max(shownCount, comments.length);
         setShownCount(open);
      }
   }
   const shown = comments.slice(0, open);
   const total = Math.max(commentCount, comments.length);
   const left = total - shown.length;

   /*
    * Read the other N asked for a page the client did not have. The whole
    * thread is read, and once it lands the next page opens: tracked as a wish,
    * settled in the click handler of the button the reader presses.
    */
   const [wanted, setWanted] = useState(false);
   if (wanted && hasReadAll) {
      setWanted(false);
      setShownCount((n) => n + PAGE);
   }

   const loadMore = () => {
      if (comments.length > open) {
         setShownCount((n) => n + PAGE);
         return;
      }
      if (!hasReadAll) {
         setWanted(true);
         onReadAll();
      }
   };

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSend) return;
      onSubmit();
      box.current?.focus();
   };

   return (
      <div
         id={id}
         className="mt-2 flex flex-col gap-3.5 border-t border-paper/12 pt-3.5"
      >
         {shown.length > 0 ? (
            <ul className="flex flex-col gap-3.5">
               {shown.map((comment, i) => {
                  const age = formatAge(comment.createdAt);
                  return (
                     <li
                        key={comment.id}
                        className="comment-in flex gap-2.5"
                        style={
                           {
                              '--i': Math.min(i % PAGE, 6),
                           } as React.CSSProperties
                        }
                     >
                        <span
                           aria-hidden="true"
                           className="g grid size-7 shrink-0 place-items-center rounded-full bg-paper/30 text-[14px] text-paper"
                        >
                           {initialOf(comment.user.displayName)}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                           <p className="text-[14px] leading-[1.3] font-semibold text-paper">
                              {comment.user.displayName}
                              {age ? (
                                 <span className="font-normal text-paper-2">
                                    {' '}
                                    · {age}
                                 </span>
                              ) : null}
                           </p>
                           <p className="text-[15px] leading-[1.5] break-words whitespace-pre-line text-paper">
                              {comment.body}
                           </p>
                        </div>
                     </li>
                  );
               })}
            </ul>
         ) : (
            <p className="text-[15px] text-paper-2">
               No comments yet. Be the first.
            </p>
         )}

         {left > 0 ? (
            /* The target is 44px; the line it draws is the 15px the frame
               holds, so the gaps above and below it stay even. */
            <button
               type="button"
               onClick={loadMore}
               disabled={isReadingAll}
               className={`${word} -my-3.5 h-11 self-start text-teal-text hover:opacity-80 disabled:opacity-50`}
            >
               {isReadingAll ? 'Reading the thread' : `Read the other ${left}`}
            </button>
         ) : null}

         {isSignedIn ? (
            <form onSubmit={handleSubmit}>
               <label htmlFor={fieldId} className="sr-only">
                  Add a comment
               </label>
               <div className="flex h-12 items-center gap-3 border-b border-dashed border-paper/35 transition-colors duration-150 [transition-timing-function:var(--ease)] focus-within:border-paper">
                  <input
                     ref={box}
                     id={fieldId}
                     type="text"
                     value={draft}
                     maxLength={COMMENT_LIMIT}
                     autoComplete="off"
                     onChange={(event) => onDraftChange(event.target.value)}
                     className="min-w-0 flex-1 bg-transparent text-[15px] text-paper outline-none placeholder:text-paper-2"
                     placeholder="Add a comment"
                     aria-describedby={error ? `${fieldId}-error` : undefined}
                     aria-invalid={error ? true : undefined}
                  />
                  <button
                     type="submit"
                     disabled={!canSend}
                     className={`${word} h-full shrink-0 text-paper hover:opacity-80 disabled:opacity-40`}
                  >
                     {isSubmitting ? 'Sending' : 'Post'}
                  </button>
               </div>
               {error ? (
                  <p
                     id={`${fieldId}-error`}
                     className="mt-2 text-[14px] text-paper"
                  >
                     {error}
                  </p>
               ) : null}
               {remaining <= 100 ? (
                  <p className="num mt-2 text-[13px] text-paper-2">
                     {remaining} left
                  </p>
               ) : null}
            </form>
         ) : (
            <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-paper-2">
               Sign in to reply.
               <Link
                  to="/sign-in"
                  className={`${word} h-11 text-teal-text hover:opacity-80`}
               >
                  Sign in
               </Link>
            </p>
         )}
      </div>
   );
}
