import { cn } from '@/lib/utils';
import { FramedPhoto } from '@/components/FramedPhoto';
import type { Framing } from '@/lib/framing';

/*
 * What will be published.
 *
 * The feed's own card, in miniature, on the step where who sees it is
 * decided: the angler, the photograph, the fish, its size and where it came
 * out. Nothing to act on, because nothing has been published yet, so the
 * likes and the replies that the real card carries are not here.
 */
export function PreviewCard({
   name,
   handle,
   avatarUrl,
   photoUrl,
   framing,
   species,
   size,
   sizeSource,
   caughtLine,
   className,
}: {
   name: string;
   handle: string | null;
   avatarUrl: string | null;
   photoUrl: string | null;
   /* The cover's framing, so this card crops it exactly as the feed will. */
   framing?: Framing | null;
   species: string;
   /* The figure as it will read, "42 cm" or "3.4 kg", or null for neither. */
   size: string | null;
   /* How it was taken, in the words the card prints beside the figure. */
   sizeSource: string | null;
   caughtLine: string;
   className?: string;
}) {
   const initial = (name || '?').trim().charAt(0).toUpperCase();

   return (
      <div className={cn('blk blk-flat', className)}>
         <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
            {avatarUrl ? (
               <img
                  src={avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-full object-cover"
               />
            ) : (
               /*
                * The same circle the feed card paints. `bg-ink-2` cannot be
                * used here: inside `.blk` the ink tokens are remapped for a
                * black ground, so ink-2 resolves to paper-2 and the circle
                * comes out pale with the letter all but gone. Paper at 30%
                * over the black is the frame's #4E4A46, and is what
                * FeedPostBlock already uses, so the preview and the real
                * card cannot drift apart.
                */
               <span className="g grid size-8 shrink-0 place-items-center rounded-full bg-paper/30 text-[16px] text-paper">
                  {initial}
               </span>
            )}
            <span className="flex min-w-0 flex-col leading-[1.25]">
               <span className="truncate text-[15px] font-semibold text-paper">
                  {name}
               </span>
               {handle ? (
                  <span className="truncate text-[13px] text-paper-2">
                     @{handle}
                  </span>
               ) : null}
            </span>
         </div>
         {photoUrl ? (
            <FramedPhoto
               src={photoUrl}
               alt=""
               framing={framing ?? null}
               className="aspect-[4/3] w-full"
            />
         ) : null}
         <div className="flex flex-col gap-1.5 px-4 pt-4 pb-[18px]">
            <span className="g text-[28px] text-paper">{species}</span>
            {size ? (
               <span className="g num flex items-baseline gap-2 text-[22px] tracking-[0.03em] text-paper">
                  {size}
                  {sizeSource ? (
                     <span className="font-sans text-[13px] tracking-normal normal-case text-paper-2">
                        {sizeSource}
                     </span>
                  ) : null}
               </span>
            ) : null}
            <span className="text-[14px] text-paper-2">{caughtLine}</span>
         </div>
      </div>
   );
}
