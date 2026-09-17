import { useId, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

import { formatStamp, plural } from '@/components/feed/format';
import type { FeedComment } from '@/components/feed/types';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const COMMENT_LIMIT = 1000;

const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/*
 * The thread under a post.
 *
 * Each reply is a small card: who, when, what. The composer is a box you can
 * see, with a send button that is a button, because a dashed underline and
 * the word Send in teal read as decoration, and nobody found them. Enter
 * sends, Shift and Enter takes a new line, and a reply appears the moment
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
   const box = useRef<HTMLTextAreaElement>(null);
   const trimmed = draft.trim();
   const remaining = COMMENT_LIMIT - draft.length;
   const hidden = Math.max(commentCount - comments.length, 0);
   const canSend = Boolean(trimmed) && !isSubmitting;

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSend) return;
      onSubmit();
      box.current?.focus();
   };

   const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
         event.preventDefault();
         if (canSend) {
            onSubmit();
         }
      }
   };

   /* The box grows with the reply, to a point, and shrinks back. */
   const grow = (node: HTMLTextAreaElement) => {
      node.style.height = 'auto';
      node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
   };

   return (
      <div
         id={id}
         className="flex flex-col gap-4 border-t border-paper/15 pt-4"
      >
         {hidden > 0 && !hasReadAll ? (
            <button
               type="button"
               onClick={onReadAll}
               disabled={isReadingAll}
               className="g-tracked inline-flex h-10 items-center gap-2 self-start text-[17px] text-teal transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
               {isReadingAll
                  ? 'Reading the thread'
                  : `Read all ${plural(commentCount, 'comment', 'comments')}`}
            </button>
         ) : null}

         {comments.length > 0 ? (
            <ul className="flex flex-col gap-3">
               {comments.map((comment, i) => {
                  const stamp = formatStamp(comment.createdAt);
                  return (
                     <li
                        key={comment.id}
                        className="comment-in flex gap-3"
                        style={{ '--i': Math.min(i, 6) } as React.CSSProperties}
                     >
                        <span
                           aria-hidden="true"
                           className="g grid size-9 shrink-0 place-items-center rounded-full bg-black-block-2 text-[18px] text-paper-2"
                        >
                           {initialOf(comment.user.displayName)}
                        </span>
                        <div className="min-w-0 flex-1 bg-black-block-2/60 px-3 py-2">
                           <p className="flex flex-wrap items-baseline gap-x-3">
                              <span className="g-tracked text-[17px] text-paper">
                                 {comment.user.displayName}
                              </span>
                              {stamp ? (
                                 <span className="lab text-paper-2">
                                    {stamp}
                                 </span>
                              ) : null}
                           </p>
                           <p className="mt-0.5 text-[15px] leading-relaxed break-words whitespace-pre-line text-paper">
                              {comment.body}
                           </p>
                        </div>
                     </li>
                  );
               })}
            </ul>
         ) : (
            <p className="text-[15px] text-paper-2">
               Nobody has said anything yet.
            </p>
         )}

         {isSignedIn ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
               <label htmlFor={fieldId} className="sr-only">
                  Add a comment
               </label>
               <div
                  className={cn(
                     'flex items-end gap-2 border bg-black-block-2/40 p-1.5 pl-3 transition-colors duration-150 [transition-timing-function:var(--ease)] focus-within:border-teal',
                     error ? 'border-destructive' : 'border-paper/25'
                  )}
               >
                  <textarea
                     ref={box}
                     id={fieldId}
                     rows={1}
                     value={draft}
                     maxLength={COMMENT_LIMIT}
                     autoComplete="off"
                     onChange={(event) => {
                        onDraftChange(event.target.value);
                        grow(event.target);
                     }}
                     onKeyDown={onKey}
                     className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-paper outline-none placeholder:text-paper-2"
                     placeholder="Say something useful"
                     aria-describedby={error ? `${fieldId}-error` : undefined}
                     aria-invalid={error ? true : undefined}
                  />
                  <button
                     type="submit"
                     disabled={!canSend}
                     aria-label={isSubmitting ? 'Sending' : 'Send'}
                     className="grid size-10 shrink-0 place-items-center bg-teal text-teal-ink transition-[transform,opacity] duration-150 [transition-timing-function:var(--ease)] hover:brightness-95 active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                     <PaperAirplaneIcon
                        aria-hidden="true"
                        className={cn(
                           'size-5 -rotate-45 translate-x-[1px]',
                           isSubmitting && 'animate-pulse'
                        )}
                     />
                  </button>
               </div>
               <div className="flex items-baseline justify-between gap-3">
                  {error ? (
                     <p
                        id={`${fieldId}-error`}
                        className="text-[14px] text-paper"
                     >
                        {error}
                     </p>
                  ) : (
                     <p className="text-[13px] text-paper-2/80">
                        Enter sends. Shift and Enter for a new line.
                     </p>
                  )}
                  {remaining <= 100 ? (
                     <p className="lab num shrink-0 text-paper-2">
                        {remaining} left
                     </p>
                  ) : null}
               </div>
            </form>
         ) : (
            <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-paper-2">
               Sign in to reply.
               <Link
                  to="/sign-in"
                  className="g-tracked inline-flex h-10 items-center text-[17px] text-teal transition-[opacity] duration-150 [transition-timing-function:var(--ease)] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
               >
                  Sign in
               </Link>
            </p>
         )}
      </div>
   );
}
