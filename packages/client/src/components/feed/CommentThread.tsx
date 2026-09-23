import {
   useEffect,
   useId,
   useLayoutEffect,
   useRef,
   useState,
   type FormEvent,
   type KeyboardEvent,
} from 'react';
import axios from 'axios';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';

import { VerifiedMark } from '@/components/profile/VerifiedMark';
import { TeamBadge } from '@/components/profile/TeamBadge';
import { isAdminSession, useSession } from '@/lib/auth-client';
import { RemoveDialog, ReportSheet } from '@/components/feed/moderation';
import { refusalWords, removeAsTeam } from '@/components/feed/moderation-api';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import {
   COMMENT_LIMIT,
   postComment,
   readThread,
   removeComment,
   saveComment,
   toggleCommentLike,
} from '@/components/feed/comments-api';
import { formatAge, plural } from '@/components/feed/format';
import {
   addComment,
   addReply,
   dropComments,
   isPending,
   locate,
   mergeThread,
   patchComment,
   settleComment,
} from '@/components/feed/thread';
import type { FeedComment, FeedPost } from '@/components/feed/types';

/*
 * Top-level comments shown before Read the other N is pressed. The card
 * arrives holding five, so five is what shows before anything is read; the
 * press brings the rest, all of it, which is what the word promises.
 */
const SHOWN_AT_FIRST = 3;
/* Replies in view before the rest go behind View N more replies. */
const REPLIES_SHOWN = 2;

/** Who is reading, as much of them as a comment of theirs prints. */
export type ThreadViewer = {
   id: string;
   displayName: string;
   username: string | null;
   /* So a comment the reader has only just written carries the same mark it
      will have once the server answers, rather than growing one on reload. */
   verified?: boolean;
   /* On the Fisherfeed team: the badge beside the name. */
   team?: boolean;
};

const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

const domIdOf = (commentId: string) => `comment-${commentId}`;

const word =
   'g-tracked inline-flex items-center tracking-[0.07em] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

/*
 * What can be done to a comment, under it. The words are 14px and the targets
 * are 44px: the row is pulled in top and bottom by what the target adds, so a
 * comment with its actions is only a line taller than one without.
 */
const rowAction = `${word} h-11 text-[14px]`;

/*
 * A handle at the head of a reply is who it answers, so it is set in the
 * accent. Only the head: an @ further in is part of the sentence, and nothing
 * here can say whether it names anyone.
 */
function Body({ text }: { text: string }) {
   const match = /^@[a-z0-9_]{3,40}(?![a-z0-9_])/i.exec(text);
   return (
      <p className="text-[15px] leading-[1.5] break-words whitespace-pre-line text-paper">
         {match ? (
            <>
               <span className="text-teal-text">{match[0]}</span>
               {text.slice(match[0].length)}
            </>
         ) : (
            text
         )}
      </p>
   );
}

/*
 * The one composer, used three ways: a new comment at the foot of the thread,
 * a reply under the comment it answers, and an edit in place of the words it
 * changes. One line that grows with what is typed. Enter sends and Shift with
 * Enter breaks the line, because a comment is a sentence far more often than
 * it is a paragraph; Escape backs out of a reply or an edit and leaves a new
 * comment alone, since there is nothing to back out to.
 */
function Composer({
   label,
   placeholder,
   value,
   onChange,
   onSubmit,
   onCancel,
   sendWord,
   canSend,
   takeFocus = false,
   error,
}: {
   label: string;
   placeholder: string;
   value: string;
   onChange: (next: string) => void;
   onSubmit: () => void;
   onCancel?: () => void;
   sendWord: string;
   canSend: boolean;
   takeFocus?: boolean;
   error?: string | null;
}) {
   const fieldId = useId();
   const box = useRef<HTMLTextAreaElement>(null);
   const remaining = COMMENT_LIMIT - value.length;

   /* As tall as the words, up to six lines; past that it scrolls. */
   useLayoutEffect(() => {
      const field = box.current;
      if (!field) return;
      field.style.height = 'auto';
      field.style.height = `${Math.min(field.scrollHeight, 168)}px`;
   }, [value]);

   /* Opened by a press, so it takes the caret, after whatever is filled in. */
   useEffect(() => {
      const field = box.current;
      if (!takeFocus || !field) return;
      field.focus({ preventScroll: false });
      field.setSelectionRange(field.value.length, field.value.length);
   }, [takeFocus]);

   const send = () => {
      if (!canSend) return;
      onSubmit();
      if (!onCancel) box.current?.focus();
   };

   const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      /* Enter also confirms a word in an input method. That is not a send. */
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Enter' && !event.shiftKey) {
         event.preventDefault();
         send();
      } else if (event.key === 'Escape' && onCancel) {
         event.preventDefault();
         event.stopPropagation();
         onCancel();
      }
   };

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      send();
   };

   return (
      <form onSubmit={handleSubmit}>
         <label htmlFor={fieldId} className="sr-only">
            {label}
         </label>
         <div className="flex min-h-12 items-end gap-3 border-b border-dashed border-paper/35 transition-colors duration-150 [transition-timing-function:var(--ease)] focus-within:border-paper">
            <textarea
               ref={box}
               id={fieldId}
               rows={1}
               value={value}
               maxLength={COMMENT_LIMIT}
               autoComplete="off"
               enterKeyHint="send"
               onChange={(event) => onChange(event.target.value)}
               onKeyDown={handleKey}
               className="thread-scroll min-w-0 flex-1 resize-none bg-transparent py-3 text-[15px] leading-6 text-paper outline-none placeholder:text-paper-2"
               placeholder={placeholder}
               aria-describedby={error ? `${fieldId}-error` : undefined}
               aria-invalid={error ? true : undefined}
            />
            {onCancel ? (
               <button
                  type="button"
                  onClick={onCancel}
                  className={`${word} h-12 shrink-0 text-[15px] text-paper-2 hover:text-paper`}
               >
                  Cancel
               </button>
            ) : null}
            <button
               type="submit"
               disabled={!canSend}
               className={`${word} h-12 shrink-0 text-[15px] text-paper hover:opacity-80 disabled:opacity-40`}
            >
               {sendWord}
            </button>
         </div>
         {error ? (
            <p id={`${fieldId}-error`} className="mt-2 text-[14px] text-paper">
               {error}
            </p>
         ) : null}
         {remaining <= 100 ? (
            <p className="num mt-2 text-[13px] text-paper-2">
               {remaining} left
            </p>
         ) : null}
      </form>
   );
}

type ReplyDraft = {
   /* The top-level comment the reply will hang from. */
   topId: string;
   /* The comment actually being answered, which may be a reply. */
   targetId: string;
   name: string;
   prefill: string;
   text: string;
};

type EditDraft = { id: string; original: string; text: string };

/*
 * The thread, inside the card, under the action row.
 *
 * A comment is a name, how long ago, and what was said: no bubble around it,
 * because the card is already a surface and a surface on a surface is just a
 * box. Under it sits what you can do to it. Replies hang from the comment they
 * answer, one level deep, behind a hairline: two show, and the rest wait
 * behind View N more replies. A reply to a reply joins the same group and
 * opens on the handle it answers.
 *
 * Everything the reader writes appears the moment it is written rather than
 * after the round trip, and is taken back, with the words returned to the
 * composer, if the server turns it away. A removal is the exception: it waits
 * for the server, because a comment that vanishes and comes back is worse than
 * one that takes a moment to go.
 */
export function CommentThread({
   id,
   postId,
   comments,
   threadCount,
   viewer,
   canModerate,
   draft,
   onDraftChange,
   onPatch,
   focusCommentId,
}: {
   id: string;
   postId: string;
   comments: FeedComment[];
   /* Top-level comments the post has, shown or not. */
   threadCount: number;
   /* Null for a reader who is not signed in: they read, and are sent to sign in to act. */
   viewer: ThreadViewer | null;
   /* The reader wrote the post, so any comment under it is theirs to remove. */
   canModerate: boolean;
   draft: string;
   onDraftChange: (next: string) => void;
   onPatch: (update: (post: FeedPost) => FeedPost) => void;
   /* A comment a link pointed at: brought into view and marked for a moment. */
   focusCommentId?: string | null;
}) {
   const signInHref = `/sign-in?next=${encodeURIComponent(`/feed?post=${postId}`)}`;

   /* Somebody else's words are reported; the team takes them down. */
   const { data: session } = useSession();
   const isTeam = isAdminSession(session?.user);
   const [reported, setReported] = useState<FeedComment | null>(null);
   const [teamRemove, setTeamRemove] = useState<FeedComment | null>(null);

   const [error, setError] = useState<string | null>(null);
   /* Said to a screen reader when something the eye can simply see happens. */
   const [said, setSaid] = useState('');
   const [reading, setReading] = useState<string | null>(null);
   const [expanded, setExpanded] = useState<Record<string, boolean>>({});
   const [reply, setReply] = useState<ReplyDraft | null>(null);
   const [edit, setEdit] = useState<EditDraft | null>(null);
   /* Kept after the sheet closes, so its words do not change on the way out. */
   const [pendingDelete, setPendingDelete] = useState<FeedComment | null>(null);
   const [confirming, setConfirming] = useState(false);
   const [removing, setRemoving] = useState<Record<string, boolean>>({});
   const [poppedId, setPoppedId] = useState<string | null>(null);
   const [flashId, setFlashId] = useState<string | null>(null);
   const likesInFlight = useRef(new Set<string>());
   const root = useRef<HTMLDivElement>(null);
   /*
    * The word that opened a reply or an edit, to hand the focus back to. Kept
    * as which comment and which word rather than as the element: the action
    * row leaves the tree while an edit is open, so the button pressed is gone
    * by the time the composer closes and a new one stands where it was.
    */
   const opener = useRef<{
      commentId: string;
      action: 'reply' | 'edit';
   } | null>(null);
   /*
    * A row written here is keyed by its temporary id for as long as it lives,
    * so the server's answer changes what it says and not which element it is.
    * Keyed by the real id it would unmount, mount again and play its arrival
    * a second time.
    */
   const [keys, setKeys] = useState<Record<string, string>>({});
   const keyOf = (comment: FeedComment) => keys[comment.id] ?? comment.id;

   /*
    * How many top-level comments are open to view, counted back from the
    * newest. The card arrives holding the newest five, so the window sits at
    * that end: a read of the whole thread (opening a group of replies does
    * one) then puts the older ones above and leaves in view the very comments
    * the reader was looking at. Counted from the front, that read swapped the
    * five on screen for the five oldest, and the comment being opened went
    * with them. A comment just written (the list grew by one) widens the
    * window by one, so it lands in view and nothing above it drops out.
    */
   const [shownCount, setShownCount] = useState(SHOWN_AT_FIRST);
   const [seenLength, setSeenLength] = useState(comments.length);
   let open = shownCount;
   if (comments.length !== seenLength) {
      /* Derived during render, the way React asks: no effect, no extra pass. */
      const grewByOne = comments.length === seenLength + 1;
      setSeenLength(comments.length);
      if (grewByOne) {
         open = shownCount + 1;
         setShownCount(open);
      }
   }
   const shown = comments.slice(Math.max(0, comments.length - open));
   const left = Math.max(threadCount, comments.length) - shown.length;

   /*
    * Counts what the server has answered for: a comment, a reply, an edit, a
    * like, a removal. A read that was already on its way when one of those
    * landed may have been taken before it, and laying it over the card would
    * quietly undo it (a reply sent while its group was opening vanished).
    * Such a read is taken again; a third write in the gap is not waited out.
    */
   const writes = useRef(0);
   const wrote = () => {
      writes.current += 1;
   };

   /* One read brings every comment and every reply. Null when it failed. */
   const readAll = async (why: string) => {
      setReading(why);
      setError(null);
      try {
         let stamp = writes.current;
         let all = await readThread(postId);
         for (let again = 0; again < 2 && stamp !== writes.current; again++) {
            stamp = writes.current;
            all = await readThread(postId);
         }
         onPatch((post) => mergeThread(post, all));
         return all;
      } catch {
         setError('The rest of the thread did not load. Try again.');
         return null;
      } finally {
         setReading(null);
      }
   };

   /* Reads the whole thread when the card does not hold it, then opens the
      window onto all of it. Infinity, because the thread can only grow. The
      word pressed goes with it, so the focus is kept on the thread rather
      than dropped on the page; the view stays where it is. */
   const loadMore = async () => {
      const inHand = comments.length >= threadCount;
      if (!inHand && !(await readAll('thread'))) return;
      setShownCount(Number.POSITIVE_INFINITY);
      window.setTimeout(() => root.current?.focus({ preventScroll: true }), 0);
   };

   /* The card holds two replies a comment. Opening a group reads the rest. */
   const expand = async (top: FeedComment) => {
      if ((top.replyCount ?? 0) > (top.replies?.length ?? 0)) {
         if (!(await readAll(top.id))) return;
      }
      setExpanded((was) => ({ ...was, [top.id]: true }));
   };

   const handBack = () => {
      const target = opener.current;
      opener.current = null;
      /* After the render that closes the composer, or the button is not there.
         A comment's own row comes before its replies, so the first match
         under the comment is its own word and not a reply's. */
      window.setTimeout(() => {
         const word = target
            ? document
                 .getElementById(domIdOf(target.commentId))
                 ?.querySelector<HTMLElement>(
                    `[data-action="${target.action}"]`
                 )
            : null;
         if (word) word.focus();
         else root.current?.focus();
      }, 0);
   };

   const submitComment = async () => {
      const body = draft.trim();
      if (!body || !viewer) return;

      const pendingId = `pending-${postId}-${Date.now()}`;
      setError(null);
      onDraftChange('');
      onPatch((post) =>
         addComment(post, {
            id: pendingId,
            parentId: null,
            body,
            createdAt: new Date().toISOString(),
            likeCount: 0,
            likedByMe: false,
            user: viewer,
         })
      );

      try {
         const saved = await postComment(postId, body);
         setKeys((was) => ({ ...was, [saved.id]: pendingId }));
         wrote();
         onPatch((post) => settleComment(post, pendingId, saved));
         setSaid('Comment posted.');
      } catch (failure) {
         onPatch((post) => dropComments(post, [pendingId]));
         onDraftChange(body);
         setError(
            refusalWords(failure) ?? 'That comment did not send. Try again.'
         );
      }
   };

   const openReply = (top: FeedComment, target: FeedComment) => {
      opener.current = { commentId: target.id, action: 'reply' };
      /* Answering yourself needs no name on it. */
      const prefill =
         target.user.username && target.user.id !== viewer?.id
            ? `@${target.user.username} `
            : '';
      setEdit(null);
      setReply({
         topId: top.id,
         targetId: target.id,
         name: target.user.displayName,
         prefill,
         text: prefill,
      });
      /* The composer sits at the foot of the group, so the group opens. */
      void expand(top);
   };

   const sendReply = async () => {
      if (!reply || !viewer) return;
      const draftReply = reply;
      const body = draftReply.text.trim();
      if (!body || body === draftReply.prefill.trim()) return;

      const pendingId = `pending-${draftReply.targetId}-${Date.now()}`;
      setError(null);
      setReply(null);
      setExpanded((was) => ({ ...was, [draftReply.topId]: true }));
      onPatch((post) =>
         addReply(post, draftReply.topId, {
            id: pendingId,
            parentId: draftReply.topId,
            body,
            createdAt: new Date().toISOString(),
            likeCount: 0,
            likedByMe: false,
            user: viewer,
         })
      );
      handBack();

      try {
         const saved = await postComment(postId, body, draftReply.targetId);
         setKeys((was) => ({ ...was, [saved.id]: pendingId }));
         wrote();
         onPatch((post) => settleComment(post, pendingId, saved));
         setSaid('Reply posted.');
      } catch (failure) {
         onPatch((post) => dropComments(post, [pendingId]));
         if (axios.isAxiosError(failure) && failure.response?.status === 404) {
            /* Removed while the reply was being written. The thread is read
               again so what is on the card is what is really there. */
            setError('That comment was removed, so the reply was not sent.');
            void readThread(postId)
               .then((all) => onPatch((post) => mergeThread(post, all)))
               .catch(() => undefined);
            return;
         }
         setReply(draftReply);
         setError(
            refusalWords(failure) ?? 'That reply did not send. Try again.'
         );
      }
   };

   const openEdit = (comment: FeedComment) => {
      opener.current = { commentId: comment.id, action: 'edit' };
      setReply(null);
      setEdit({ id: comment.id, original: comment.body, text: comment.body });
   };

   const saveEdit = async () => {
      if (!edit) return;
      const draftEdit = edit;
      const body = draftEdit.text.trim();
      if (!body) return;

      setEdit(null);
      handBack();
      /* Saved as it stood: nothing to send, and nothing to mark as edited. */
      if (body === draftEdit.original.trim()) return;

      const found = locate(comments, draftEdit.id);
      const before = found
         ? found.isReply
            ? found.top.replies?.find((entry) => entry.id === draftEdit.id)
            : found.top
         : null;
      const priorEditedAt = before?.editedAt ?? null;

      setError(null);
      onPatch((post) =>
         patchComment(post, draftEdit.id, (entry) => ({
            ...entry,
            body,
            editedAt: new Date().toISOString(),
         }))
      );

      try {
         const saved = await saveComment(draftEdit.id, body);
         wrote();
         onPatch((post) =>
            patchComment(post, draftEdit.id, (entry) => ({
               ...entry,
               body: saved.body,
               editedAt: saved.editedAt ?? entry.editedAt,
            }))
         );
         setSaid('Comment saved.');
      } catch (failure) {
         onPatch((post) =>
            patchComment(post, draftEdit.id, (entry) => ({
               ...entry,
               body: draftEdit.original,
               editedAt: priorEditedAt,
            }))
         );
         setEdit(draftEdit);
         setError(
            refusalWords(failure) ?? 'That edit was not kept. Try again.'
         );
      }
   };

   const cancelCompose = () => {
      setReply(null);
      setEdit(null);
      handBack();
   };

   const toggleLike = async (comment: FeedComment) => {
      if (likesInFlight.current.has(comment.id)) return;
      likesInFlight.current.add(comment.id);

      const liking = !comment.likedByMe;
      const settle = (liked: boolean, likeCount: number) =>
         onPatch((post) =>
            patchComment(post, comment.id, (entry) => ({
               ...entry,
               likedByMe: liked,
               likeCount: Math.max(0, likeCount),
            }))
         );

      setError(null);
      setPoppedId(liking ? comment.id : null);
      settle(liking, (comment.likeCount ?? 0) + (liking ? 1 : -1));

      try {
         /* The table's own figure, so two devices settle on the same number. */
         const result = await toggleCommentLike(comment.id);
         wrote();
         settle(result.liked, result.likeCount);
      } catch {
         settle(!liking, comment.likeCount ?? 0);
         setError('That like did not save. Try again.');
      } finally {
         likesInFlight.current.delete(comment.id);
      }
   };

   const confirmDelete = async () => {
      const target = pendingDelete;
      if (!target) return;
      setConfirming(false);
      setError(null);
      setRemoving((was) => ({ ...was, [target.id]: true }));
      if (
         reply &&
         (reply.topId === target.id || reply.targetId === target.id)
      ) {
         setReply(null);
      }
      if (edit?.id === target.id) setEdit(null);

      try {
         const result = await removeComment(target.id);
         wrote();
         onPatch((post) =>
            dropComments(post, result.removedIds, result.commentCount)
         );
         setSaid(
            result.removed > 1
               ? `Comment and ${plural(result.removed - 1, 'reply', 'replies')} deleted.`
               : 'Comment deleted.'
         );
         /* The button that was pressed went with the comment. */
         window.setTimeout(() => root.current?.focus(), 0);
      } catch (failure) {
         if (axios.isAxiosError(failure) && failure.response?.status === 404) {
            /* Already gone, from another tab or by the post's owner. */
            onPatch((post) => dropComments(post, [target.id]));
         } else {
            setError('That comment was not deleted. Try again.');
         }
      } finally {
         setRemoving((was) => {
            const next = { ...was };
            delete next[target.id];
            return next;
         });
      }
   };

   /* The team's removal: the same drop from the thread as a delete. */
   const takeDownAsTeam = async () => {
      const target = teamRemove;
      if (!target) return;
      setTeamRemove(null);
      setError(null);
      setRemoving((was) => ({ ...was, [target.id]: true }));
      if (
         reply &&
         (reply.topId === target.id || reply.targetId === target.id)
      ) {
         setReply(null);
      }
      if (edit?.id === target.id) setEdit(null);
      try {
         const result = await removeAsTeam('comment', target.id);
         /* A read of the thread already on its way must not put it back. */
         wrote();
         onPatch((post) =>
            dropComments(
               post,
               result.removedIds ?? [target.id],
               result.commentCount ?? undefined
            )
         );
         setSaid('Comment taken down.');
         window.setTimeout(() => root.current?.focus(), 0);
      } catch {
         setError('That comment is still up. Try again.');
      } finally {
         setRemoving((was) => {
            const next = { ...was };
            delete next[target.id];
            return next;
         });
      }
   };

   /*
    * A link pointed at one comment. The card may not hold it (it carries five
    * comments and two replies each), so the thread is read once if it has to
    * be, then the comment is opened to: its page of the thread, its group of
    * replies, and a mark that fades.
    */
   const latest = useRef(comments);
   useEffect(() => {
      latest.current = comments;
   }, [comments]);
   useEffect(() => {
      if (!focusCommentId) return;
      let alive = true;
      void (async () => {
         let list = latest.current;
         if (!locate(list, focusCommentId)) {
            const all = await readAll('thread');
            if (!alive || !all) return;
            list = all;
         }
         const found = locate(list, focusCommentId);
         if (!found) {
            setError('That comment is no longer here.');
            return;
         }
         /* The window counts back from the newest, so it opens far enough
            back to take in the comment the link names. */
         const index = list.findIndex((entry) => entry.id === found.top.id);
         setShownCount((n) => Math.max(n, list.length - index));
         if (found.isReply) {
            setExpanded((was) => ({ ...was, [found.top.id]: true }));
         }
         setFlashId(focusCommentId);
      })();
      return () => {
         alive = false;
      };
      /* Runs for the link, not for every change to the thread it opens. */
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [focusCommentId, postId]);

   /*
    * The mark is only put on once the page can be seen. A link opened from
    * outside the app (a push, a shared address) is a fresh load, and the
    * thread is read and scrolled to behind the boot splash, which holds the
    * page hidden for two seconds or so: marked then, the fade would be over
    * before anybody saw it.
    */
   const [lit, setLit] = useState(false);
   useEffect(() => {
      if (!flashId) return;
      const row = document.getElementById(domIdOf(flashId));
      if (!row) return;
      const calm = window.matchMedia(
         '(prefers-reduced-motion: reduce)'
      ).matches;
      const veil = row.closest('[aria-hidden="true"]');
      /* Behind the splash nobody watches it travel, so it simply goes. */
      row.scrollIntoView({
         block: 'center',
         behavior: calm || veil ? 'auto' : 'smooth',
      });
      if (!veil) {
         setLit(true);
         return;
      }
      const watch = new MutationObserver(() => {
         if (veil.getAttribute('aria-hidden') === 'true') return;
         watch.disconnect();
         setLit(true);
      });
      watch.observe(veil, {
         attributes: true,
         attributeFilter: ['aria-hidden'],
      });
      return () => watch.disconnect();
   }, [flashId]);

   const renderComment = (
      comment: FeedComment,
      top: FeedComment,
      index: number
   ) => {
      const isReply = comment.id !== top.id;
      const age = formatAge(comment.createdAt);
      const mine = Boolean(viewer && comment.user.id === viewer.id);
      const waiting = isPending(comment);
      const going = Boolean(removing[comment.id]);
      const editing = edit?.id === comment.id;
      const likes = Math.max(0, comment.likeCount ?? 0);
      const name = comment.user.displayName;

      const replies = isReply ? [] : (comment.replies ?? []);
      const replyTotal = Math.max(comment.replyCount ?? 0, replies.length);
      const isOpen = Boolean(expanded[comment.id]);
      const visibleReplies = isOpen ? replies : replies.slice(0, REPLIES_SHOWN);
      const hidden = replyTotal - visibleReplies.length;
      const replyingHere = !isReply && reply?.topId === comment.id;
      const repliesId = `replies-${comment.id}`;

      return (
         <li
            key={keyOf(comment)}
            id={domIdOf(comment.id)}
            className="comment-in"
            /* The first few land one after another; the rest of a long
               thread arrive together on the beat after them. */
            style={{ '--i': Math.min(index, 6) } as React.CSSProperties}
            aria-busy={going || undefined}
         >
            {/* The arrival animates the row and holds its last frame, which
                would pin the opacity; the dimming and the mark go inside. */}
            <div
               className={`flex ${isReply ? 'gap-2' : 'gap-2.5'} ${lit && flashId === comment.id ? 'comment-flash' : ''} ${going ? 'pointer-events-none opacity-40' : ''} transition-opacity duration-200 [transition-timing-function:var(--ease)]`}
            >
               <span
                  aria-hidden="true"
                  className={`g grid shrink-0 place-items-center rounded-full bg-paper/30 text-paper ${isReply ? 'size-6 text-[12px]' : 'size-7 text-[14px]'}`}
               >
                  {initialOf(name)}
               </span>
               <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[14px] leading-[1.3] font-semibold text-paper">
                     {name}
                     {comment.user.verified ? (
                        <VerifiedMark className="size-[12px]" />
                     ) : null}
                     {comment.user.team ? <TeamBadge /> : null}
                     {age ? (
                        <span className="font-normal text-paper-2">
                           {' '}
                           · {age}
                        </span>
                     ) : null}
                     {comment.editedAt ? (
                        <span className="font-normal text-paper-2">
                           {' '}
                           · edited
                        </span>
                     ) : null}
                  </p>

                  {editing && edit ? (
                     <div className="comment-in">
                        <Composer
                           label={
                              isReply ? 'Edit your reply' : 'Edit your comment'
                           }
                           placeholder="Say it again"
                           value={edit.text}
                           onChange={(next) => setEdit({ ...edit, text: next })}
                           onSubmit={() => void saveEdit()}
                           onCancel={cancelCompose}
                           sendWord="Save"
                           canSend={Boolean(edit.text.trim())}
                           takeFocus
                        />
                     </div>
                  ) : (
                     <Body text={comment.body} />
                  )}

                  {editing ? null : (
                     <div className="-mt-1.5 -mb-2.5 flex flex-wrap items-center gap-x-4">
                        {viewer ? (
                           <button
                              type="button"
                              aria-pressed={comment.likedByMe === true}
                              /* The label is the whole name, so the figure the
                              eye reads beside the heart is said in it too. */
                              aria-label={`Like the ${isReply ? 'reply' : 'comment'} by ${name}${likes > 0 ? `, ${plural(likes, 'like', 'likes')}` : ''}`}
                              disabled={waiting}
                              onClick={() => void toggleLike(comment)}
                              className={`${rowAction} -ml-2.5 min-w-11 justify-center gap-1 px-2.5 disabled:opacity-40 ${comment.likedByMe ? 'text-teal-text' : 'text-paper-2 hover:text-paper'}`}
                           >
                              {comment.likedByMe ? (
                                 <HeartSolid
                                    aria-hidden="true"
                                    className={`size-[18px] ${poppedId === comment.id ? 'heart-pop' : ''}`}
                                 />
                              ) : (
                                 <HeartIcon
                                    aria-hidden="true"
                                    className="size-[18px]"
                                    strokeWidth={1.5}
                                 />
                              )}
                              {likes > 0 ? (
                                 <span className="num text-[15px] tracking-[0.04em]">
                                    {likes}
                                 </span>
                              ) : null}
                           </button>
                        ) : (
                           <Link
                              to={signInHref}
                              aria-label={
                                 likes > 0
                                    ? `${plural(likes, 'like', 'likes')}. Sign in to like`
                                    : 'Sign in to like'
                              }
                              className={`${rowAction} -ml-2.5 min-w-11 justify-center gap-1 px-2.5 text-paper-2 hover:text-paper`}
                           >
                              <HeartIcon
                                 aria-hidden="true"
                                 className="size-[18px]"
                                 strokeWidth={1.5}
                              />
                              {likes > 0 ? (
                                 <span className="num text-[15px] tracking-[0.04em]">
                                    {likes}
                                 </span>
                              ) : null}
                           </Link>
                        )}

                        {viewer ? (
                           <button
                              type="button"
                              disabled={waiting}
                              aria-expanded={reply?.targetId === comment.id}
                              aria-label={`Reply to ${name}`}
                              data-action="reply"
                              onClick={() => openReply(top, comment)}
                              className={`${rowAction} text-paper-2 hover:text-paper disabled:opacity-40`}
                           >
                              Reply
                           </button>
                        ) : (
                           <Link
                              to={signInHref}
                              aria-label={`Sign in to reply to ${name}`}
                              className={`${rowAction} text-paper-2 hover:text-paper`}
                           >
                              Reply
                           </Link>
                        )}

                        {mine ? (
                           <button
                              type="button"
                              disabled={waiting}
                              aria-label={
                                 isReply
                                    ? 'Edit your reply'
                                    : 'Edit your comment'
                              }
                              data-action="edit"
                              onClick={() => openEdit(comment)}
                              className={`${rowAction} text-paper-2 hover:text-paper disabled:opacity-40`}
                           >
                              Edit
                           </button>
                        ) : null}

                        {mine || (canModerate && viewer) ? (
                           <button
                              type="button"
                              disabled={waiting}
                              aria-label={
                                 mine
                                    ? isReply
                                       ? 'Delete your reply'
                                       : 'Delete your comment'
                                    : `Delete the ${isReply ? 'reply' : 'comment'} by ${name}`
                              }
                              onClick={() => {
                                 setPendingDelete(comment);
                                 setConfirming(true);
                              }}
                              className={`${rowAction} text-paper-2 hover:text-paper disabled:opacity-40`}
                           >
                              Delete
                           </button>
                        ) : null}

                        {!mine && viewer && !isTeam && !waiting ? (
                           <button
                              type="button"
                              aria-label={`Report the ${isReply ? 'reply' : 'comment'} by ${name}`}
                              onClick={() => setReported(comment)}
                              className={`${rowAction} text-paper-2 hover:text-paper`}
                           >
                              Report
                           </button>
                        ) : null}

                        {!mine && isTeam && !waiting ? (
                           <button
                              type="button"
                              aria-label={`Take down the ${isReply ? 'reply' : 'comment'} by ${name}`}
                              onClick={() => setTeamRemove(comment)}
                              className={`${rowAction} text-paper-2 hover:text-[#f0716a]`}
                           >
                              Take down
                           </button>
                        ) : null}
                     </div>
                  )}

                  {!isReply && (replyTotal > 0 || replyingHere) ? (
                     <div className="mt-3 flex flex-col gap-3 border-l border-paper/14 pl-3">
                        {visibleReplies.length > 0 ? (
                           <ul
                              id={repliesId}
                              aria-label={`Replies to ${name}`}
                              className="flex flex-col gap-3"
                           >
                              {visibleReplies.map((entry, i) =>
                                 renderComment(entry, comment, i)
                              )}
                           </ul>
                        ) : null}

                        {hidden > 0 ? (
                           <button
                              type="button"
                              aria-expanded={false}
                              aria-controls={repliesId}
                              disabled={reading === comment.id}
                              onClick={() => void expand(comment)}
                              className={`${rowAction} -my-3 self-start text-teal-text hover:opacity-80 disabled:opacity-50`}
                           >
                              {reading === comment.id
                                 ? 'Reading the replies'
                                 : `View ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}`}
                           </button>
                        ) : isOpen && replyTotal > REPLIES_SHOWN ? (
                           <button
                              type="button"
                              aria-expanded={true}
                              aria-controls={repliesId}
                              onClick={() =>
                                 setExpanded((was) => ({
                                    ...was,
                                    [comment.id]: false,
                                 }))
                              }
                              className={`${rowAction} -my-3 self-start text-paper-2 hover:text-paper`}
                           >
                              Show fewer replies
                           </button>
                        ) : null}

                        {replyingHere && reply ? (
                           <div className="comment-in">
                              <Composer
                                 label={`Reply to ${reply.name}`}
                                 placeholder={`Reply to ${reply.name}`}
                                 value={reply.text}
                                 onChange={(next) =>
                                    setReply({ ...reply, text: next })
                                 }
                                 onSubmit={() => void sendReply()}
                                 onCancel={cancelCompose}
                                 sendWord="Reply"
                                 canSend={
                                    Boolean(reply.text.trim()) &&
                                    reply.text.trim() !== reply.prefill.trim()
                                 }
                                 takeFocus
                                 /* A new target is a new composer: it takes the
                                 focus again and starts from the new handle. */
                                 key={reply.targetId}
                              />
                           </div>
                        ) : null}
                     </div>
                  ) : null}
               </div>
            </div>
         </li>
      );
   };

   const deleteReplies = pendingDelete
      ? Math.max(
           pendingDelete.replyCount ?? 0,
           pendingDelete.replies?.length ?? 0
        )
      : 0;
   const deletingReply = Boolean(pendingDelete?.parentId);
   const deletingOthers = Boolean(
      pendingDelete && viewer && pendingDelete.user.id !== viewer.id
   );

   return (
      <div
         id={id}
         ref={root}
         tabIndex={-1}
         className="mt-2 flex flex-col gap-3.5 border-t border-paper/12 pt-3.5 outline-none"
      >
         {left > 0 ? (
            /* Above the list, because what it brings are the older comments
               and they land above the ones in view. The target is 44px; the
               line it draws is the 15px the frame holds, so the gaps above
               and below it stay even. */
            <button
               type="button"
               onClick={() => void loadMore()}
               disabled={reading === 'thread'}
               className={`${word} -my-3.5 h-11 self-start text-[15px] text-teal-text hover:opacity-80 disabled:opacity-50`}
            >
               {reading === 'thread'
                  ? 'Reading the thread'
                  : `Read the other ${left}`}
            </button>
         ) : null}

         {shown.length > 0 ? (
            /* A long thread scrolls inside the card rather than stretching
               the post down the feed. */
            <ul className="thread-scroll -mr-2 flex max-h-[440px] flex-col gap-4 overflow-y-auto overscroll-contain pr-2">
               {shown.map((comment, i) => renderComment(comment, comment, i))}
            </ul>
         ) : (
            <p className="text-[15px] text-paper-2">
               No comments yet. Be the first.
            </p>
         )}

         {error ? (
            <p role="alert" className="text-[14px] text-paper">
               {error}
            </p>
         ) : null}
         <p className="sr-only" role="status">
            {said}
         </p>

         {viewer ? (
            <Composer
               label="Add a comment"
               placeholder="Add a comment"
               value={draft}
               onChange={onDraftChange}
               onSubmit={() => void submitComment()}
               sendWord="Post"
               canSend={Boolean(draft.trim())}
            />
         ) : (
            <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-paper-2">
               Sign in to comment, reply or like.
               <Link
                  to={signInHref}
                  className={`${word} h-11 text-[15px] text-teal-text hover:opacity-80`}
               >
                  Sign in
               </Link>
            </p>
         )}

         {reported ? (
            <ReportSheet
               open
               onOpenChange={(open) => {
                  if (!open) setReported(null);
               }}
               kind="comment"
               id={reported.id}
               author={reported.user.displayName}
            />
         ) : null}
         {teamRemove ? (
            <RemoveDialog
               open
               onOpenChange={(open) => {
                  if (!open) setTeamRemove(null);
               }}
               kind="comment"
               author={teamRemove.user.displayName}
               excerpt={teamRemove.body}
               onConfirm={() => void takeDownAsTeam()}
            />
         ) : null}

         <Dialog open={confirming} onOpenChange={setConfirming}>
            {/* The sheet is black in both themes, so the red is the one that
                reads on black in both. */}
            <DialogContent className="gap-0 [--destructive:#f0716a] sm:max-w-[480px]">
               <DialogHeader className="text-left">
                  <DialogTitle className="g pr-10 text-[32px] font-normal text-paper">
                     {deletingReply
                        ? 'Delete this reply?'
                        : 'Delete this comment?'}
                  </DialogTitle>
                  <DialogDescription className="text-[15px] text-paper-2">
                     {deletingOthers && pendingDelete
                        ? `${pendingDelete.user.displayName} wrote it under your post. `
                        : null}
                     {deleteReplies > 0
                        ? `This also removes its ${plural(deleteReplies, 'reply', 'replies')}. `
                        : null}
                     It cannot be undone.
                  </DialogDescription>
               </DialogHeader>
               {pendingDelete ? (
                  <p className="mt-4 line-clamp-3 border-l-2 border-paper/30 pl-3 text-[15px] leading-[1.5] break-words text-paper">
                     {pendingDelete.body}
                  </p>
               ) : null}
               <DialogFooter className="mt-6 flex-col gap-3 sm:flex-row">
                  <Button
                     type="button"
                     size="lg"
                     variant="ghost"
                     className="text-paper-2 hover:bg-paper/10 hover:text-paper"
                     onClick={() => setConfirming(false)}
                  >
                     Keep it
                  </Button>
                  <Button
                     type="button"
                     size="lg"
                     variant="destructive"
                     onClick={() => void confirmDelete()}
                  >
                     Delete
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   );
}
