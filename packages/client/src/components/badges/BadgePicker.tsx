import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CheckIcon } from '@heroicons/react/24/outline';
import { BadgeChip } from '@/components/badges/Badge';
import {
   awardBadge,
   removeBadge,
   type CatchBadge,
} from '@/components/badges/badges-api';
import { BADGE_KINDS, BADGES, type BadgeKind } from '@/components/badges/kinds';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { isAdminSession, useSession } from '@/lib/auth-client';
import { useMediaQuery } from '@/lib/media';
import { cn } from '@/lib/utils';

/*
 * The control that pins a badge on a fish, and the panel behind it.
 *
 * Nobody but the Fisherfeed team ever sees this. The check here is the session
 * flag, which decides what is drawn and nothing else: the three routes it calls
 * read the role off the database on every request and answer 404 to everybody
 * else, so a browser that forced this onto the screen would have a picker that
 * does nothing.
 *
 * A tap pins the badge at once and tells the angler afterwards. The row goes on
 * the card before the server has answered, because the team is going through a
 * feed marking fish and waiting on a round trip each time is how that job stops
 * being done. If the write fails the badge comes off again and the failure is
 * said out loud. Every tap can be undone from the line that confirms it, in
 * both directions: one that pinned, and one that took off.
 */

const NOTE_LIMIT = 140;

export function BadgeControl({
   catchId,
   /* What to call the fish in the confirmation line. */
   fishName,
   badges,
   onChange,
   tone = 'dark',
   compact = false,
   className,
}: {
   catchId: string;
   fishName: string;
   badges: CatchBadge[];
   /* The parent holds the badges, so the card and the record both update at
      once. `landed` is the kind that has just arrived, for the animation. */
   onChange: (next: CatchBadge[], landed: BadgeKind | null) => void;
   /* Which ground it is standing on: a black feed card, or the paper record. */
   tone?: 'dark' | 'light';
   /*
    * The mark on its own, for the card's action row, where it stands in a line
    * of hearts and bubbles and a word would push the card's one real action
    * onto a second line. Named for a screen reader either way.
    */
   compact?: boolean;
   className?: string;
}) {
   const { data } = useSession();
   const [open, setOpen] = useState(false);
   const [note, setNote] = useState('');
   const [busy, setBusy] = useState<BadgeKind | null>(null);
   /* A phone, or a window too short to hang a panel in: the same rule the
      pickers use, so this opens the way everything else in the app opens. */
   const sheet = useMediaQuery('(max-width: 767px), (max-height: 540px)');

   /*
    * What is on the fish right now, rather than what was on it when the tap
    * that opened a toast happened. Undo is pressed seconds later, and by then
    * the team may have pinned another one: reading the list from a closure
    * would put the card back the way it looked before both.
    */
   const latest = useRef(badges);
   latest.current = badges;

   if (!isAdminSession(data?.user)) return null;

   const team = data?.user?.name?.trim() || 'Fisherfeed team';
   const on = new Set(badges.map((badge) => badge.kind));

   const pin = async (kind: BadgeKind, line: string | null) => {
      if (busy) return;
      setBusy(kind);
      /*
       * On a phone the panel is a sheet, and a sheet is modal: it covers the
       * line that confirms the badge and takes its Undo out of the page a
       * screen reader can read. Shut it on the way in, so the badge lands on
       * the fish itself and the confirmation is where it can be pressed.
       */
      if (sheet) setOpen(false);
      const before = latest.current;
      /* What the card shows while the server is being asked. The real row
         replaces it a moment later and carries the same shape. */
      const pending: CatchBadge = {
         id: `pending-${kind}`,
         kind,
         note: line,
         createdAt: new Date().toISOString(),
         awardedBy: {
            id: data?.user?.id ?? '',
            displayName: team,
            username: null,
         },
      };
      onChange([...before, pending], kind);
      try {
         const saved = await awardBadge(catchId, kind, line);
         onChange(
            [...latest.current.filter((badge) => badge.kind !== kind), saved],
            kind
         );
         setNote('');
         toast({
            title: `${BADGES[kind].name} on ${fishName}.`,
            action: { label: 'Undo', onClick: () => void unpin(kind, true) },
         });
      } catch {
         onChange(
            latest.current.filter((badge) => badge.kind !== kind),
            null
         );
         toast({
            title: 'That badge did not go on.',
            description: 'Try again in a moment.',
            variant: 'error',
         });
      } finally {
         setBusy(null);
      }
   };

   const unpin = async (kind: BadgeKind, quiet = false) => {
      if (busy) return;
      setBusy(kind);
      if (sheet) setOpen(false);
      const before = latest.current;
      const line = before.find((badge) => badge.kind === kind)?.note ?? null;
      onChange(
         before.filter((badge) => badge.kind !== kind),
         null
      );
      try {
         await removeBadge(catchId, kind);
         if (!quiet) {
            toast({
               title: `${BADGES[kind].name} taken off.`,
               action: { label: 'Undo', onClick: () => void pin(kind, line) },
            });
         }
      } catch {
         onChange(before, null);
         toast({
            title: 'That badge did not come off.',
            description: 'Try again in a moment.',
            variant: 'error',
         });
      } finally {
         setBusy(null);
      }
   };

   const head = (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-2">
         <span className="lab text-ink-3">Fisherfeed team</span>
         <button
            type="button"
            onClick={() => setOpen(false)}
            className="g-tracked inline-flex h-10 items-center bg-ink px-3 text-[16px] text-background"
         >
            Done
         </button>
      </div>
   );

   const noteField = (
      <label className="flex shrink-0 flex-col gap-1 px-3 pt-2.5 pb-1">
         <span className="lab">A line from the team</span>
         <input
            type="text"
            value={note}
            maxLength={NOTE_LIMIT}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional"
            className="input-line"
         />
      </label>
   );

   const list = (
      <ul className="thread-scroll min-h-0 flex-1 overflow-y-auto pb-1">
         {BADGE_KINDS.map((kind) => {
            const pinned = on.has(kind);
            return (
               <li key={kind}>
                  <button
                     type="button"
                     aria-pressed={pinned}
                     disabled={busy !== null}
                     onClick={() =>
                        pinned ? void unpin(kind) : void pin(kind, note || null)
                     }
                     className={cn(
                        'flex min-h-12 w-full items-center gap-3 border-l-[3px] px-3 text-left transition-colors duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal disabled:opacity-45',
                        pinned
                           ? 'border-teal bg-teal/10'
                           : 'border-transparent hover:bg-bg-2'
                     )}
                  >
                     <BadgeChip kind={kind} />
                     <span className="flex min-w-0 flex-1 flex-col">
                        <span className="g-tracked text-[16px] text-ink">
                           {BADGES[kind].name}
                        </span>
                        <span className="text-[13px] leading-snug text-ink-3">
                           {BADGES[kind].line}
                        </span>
                     </span>
                     <span
                        aria-hidden="true"
                        className={cn(
                           'grid size-5 shrink-0 place-items-center border',
                           pinned
                              ? 'border-ink bg-ink text-background'
                              : 'border-line-2'
                        )}
                     >
                        {pinned ? (
                           <CheckIcon className="size-3.5" strokeWidth={3} />
                        ) : null}
                     </span>
                  </button>
               </li>
            );
         })}
      </ul>
   );

   const name = badges.length > 0 ? 'Badges' : 'Badge it';
   const quiet =
      tone === 'dark'
         ? 'text-paper-2 hover:text-paper'
         : 'text-ink-2 hover:text-ink';

   const trigger = (
      <button
         type="button"
         aria-haspopup="dialog"
         aria-expanded={open}
         aria-label={compact ? name : undefined}
         onClick={sheet ? () => setOpen(true) : undefined}
         className={cn(
            'g-tracked inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap tracking-[0.07em] transition-[color,opacity] duration-150 [transition-timing-function:var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
            /* Teal while the fish carries one, quiet while it does not: the
               same thing the heart and the bookmark beside it say. */
            badges.length > 0 ? 'text-teal-text' : quiet,
            className
         )}
      >
         <span
            aria-hidden="true"
            className={cn('badge-cue', compact && 'badge-cue-lg')}
         />
         {compact ? null : name}
      </button>
   );

   const panel = (
      <>
         {head}
         {noteField}
         {list}
      </>
   );

   if (sheet) {
      return (
         <>
            {trigger}
            <Sheet
               open={open}
               onOpenChange={setOpen}
               title="Badges"
               className="badge-sheet"
            >
               <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
            </Sheet>
         </>
      );
   }

   /*
    * Not modal. A modal popover marks the whole rest of the page aria-hidden
    * while it is open, and the line that confirms a badge is raised out in
    * that rest: modal, it was announced to nobody and its Undo could not be
    * reached by keyboard. An outside tap and Escape still shut it, which is
    * all this panel needs.
    */
   return (
      <Popover.Root open={open} onOpenChange={setOpen}>
         <Popover.Trigger asChild>{trigger}</Popover.Trigger>
         <Popover.Portal>
            <Popover.Content
               aria-label="Badges from the Fisherfeed team"
               align="start"
               sideOffset={6}
               collisionPadding={{ top: 68, right: 12, bottom: 12, left: 12 }}
               className="badge-panel blk-plain z-[1000] flex w-[min(360px,calc(100vw-24px))] flex-col border border-line bg-background text-ink shadow-[0_10px_30px_rgba(11,9,9,0.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
            >
               {panel}
            </Popover.Content>
         </Popover.Portal>
      </Popover.Root>
   );
}
