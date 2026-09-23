import { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { Sheet } from '@/components/ui/sheet';
import { RadioDot } from '@/components/social/StepLine';
import { toast } from '@/components/ui/use-toast';
import {
   REPORT_REASONS,
   refusalWords,
   reportContent,
   type ReportKind,
   type ReportReason,
} from '@/components/feed/moderation-api';

/*
 * Keeping the feed decent: a report from anyone, and a removal by the team.
 *
 * A report is a reason and, if the reader wants, a sentence. The server holds
 * it, hides the thing once enough different people have reported it, and the
 * team decides in the admin panel. Nothing here hides anything itself: the
 * reporter is thanked and the post stays where it is until the team or the
 * count says otherwise.
 */

export function ReportSheet({
   open,
   onOpenChange,
   kind,
   id,
   author,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   kind: ReportKind;
   id: string;
   /* Whose it is, for the heading. */
   author: string;
}) {
   const [reason, setReason] = useState<ReportReason | null>(null);
   const [note, setNote] = useState('');
   const [busy, setBusy] = useState(false);
   const [problem, setProblem] = useState<string | null>(null);

   const close = (next: boolean) => {
      onOpenChange(next);
      if (!next) {
         setReason(null);
         setNote('');
         setProblem(null);
      }
   };

   const send = async () => {
      if (!reason) {
         setProblem('Pick a reason.');
         return;
      }
      setBusy(true);
      setProblem(null);
      try {
         const result = await reportContent(
            kind,
            id,
            reason,
            note.trim() || null
         );
         toast({ title: result.message, variant: 'success' });
         close(false);
      } catch (error) {
         setProblem(
            refusalWords(error) ??
               (axios.isAxiosError(error) && error.response?.status === 404
                  ? 'That is not there any more.'
                  : 'The report did not send. Try again.')
         );
      } finally {
         setBusy(false);
      }
   };

   const what = kind === 'post' ? 'post' : 'comment';

   return (
      <Sheet open={open} onOpenChange={close} title={`Report this ${what}`}>
         <div className="flex flex-col gap-4 p-4 md:mx-auto md:w-full md:max-w-[560px]">
            <div>
               <h2 className="g text-[26px]">Report this {what}</h2>
               <p className="mt-1 text-[15px] text-ink-2">
                  By {author}. Only the Fisherfeed team sees who reported it.
               </p>
            </div>

            <div
               role="radiogroup"
               aria-label="Why"
               className="flex flex-col border-t border-line"
            >
               {/* The rows of the competition form's choices, as radios. */}
               {REPORT_REASONS.map((option) => (
                  <button
                     key={option.value}
                     type="button"
                     role="radio"
                     aria-checked={reason === option.value}
                     onClick={() => {
                        setReason(option.value);
                        setProblem(null);
                     }}
                     className="flex h-12 w-full items-center gap-3 border-b border-line text-left"
                  >
                     <RadioDot on={reason === option.value} />
                     <span className="text-[16px]">{option.label}</span>
                  </button>
               ))}
            </div>

            <label className="flex flex-col gap-2">
               <span className="lab">Anything the team should know</span>
               <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="Optional"
                  className="w-full resize-none border-b border-dashed border-line-2 bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink"
               />
            </label>

            {problem ? (
               <p role="alert" className="text-[14px] text-ink">
                  {problem}
               </p>
            ) : null}

            <div className="flex gap-2.5">
               <Button
                  type="button"
                  className="flex-1 text-[18px]"
                  disabled={busy}
                  onClick={() => void send()}
               >
                  {busy ? 'Sending' : 'Send report'}
               </Button>
               <Button
                  type="button"
                  variant="outline"
                  className="text-[18px]"
                  onClick={() => close(false)}
               >
                  Cancel
               </Button>
            </div>
         </div>
      </Sheet>
   );
}

/*
 * The team's removal, asked once. Black in both themes like the author's own
 * delete, so the red is the one that reads on black either way.
 */
export function RemoveDialog({
   open,
   onOpenChange,
   kind,
   author,
   excerpt,
   onConfirm,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   kind: ReportKind;
   author: string;
   excerpt: string | null;
   onConfirm: () => void;
}) {
   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="gap-0 [--destructive:#f0716a] sm:max-w-[480px]">
            <DialogHeader className="text-left">
               <DialogTitle className="g pr-10 text-[32px] font-normal text-paper">
                  {kind === 'post'
                     ? 'Take this post down?'
                     : 'Take this comment down?'}
               </DialogTitle>
               <DialogDescription className="text-[15px] text-paper-2">
                  {author} posted it. It comes off the feed for everybody
                  {kind === 'comment' ? ', with its replies' : ''}, and any
                  reports on it are closed.
               </DialogDescription>
            </DialogHeader>
            {excerpt ? (
               <p className="mt-4 line-clamp-3 border-l-2 border-paper/30 pl-3 text-[15px] leading-[1.5] break-words text-paper">
                  {excerpt}
               </p>
            ) : null}
            <DialogFooter className="mt-6 flex-col gap-3 sm:flex-row">
               <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="text-paper-2 hover:bg-paper/10 hover:text-paper"
                  onClick={() => onOpenChange(false)}
               >
                  Leave it up
               </Button>
               <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  onClick={onConfirm}
               >
                  Take it down
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
