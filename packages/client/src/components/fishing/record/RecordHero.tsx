import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { FishMark } from '@/components/brand/FishMark';
import { Img } from '@/components/Img';

/*
 * The record's photograph: native ratio on a black ground so a portrait fish is
 * never cropped, a scrim so the name can sit on it, and the gallery when there is
 * more than one. The photo settles from 105% once the record has built.
 */
export function RecordHero({
   images,
   index,
   onIndexChange,
   onBack,
   eyebrow,
   title,
   headline,
   built,
}: {
   images: {
      id: string;
      url: string;
      cardUrl?: string | null;
      thumbUrl?: string | null;
   }[];
   index: number;
   onIndexChange: (next: number) => void;
   onBack: () => void;
   eyebrow: string;
   title: string;
   headline: ReactNode;
   built: boolean;
}) {
   const count = images.length;
   const current = count > 0 ? images[Math.min(index, count - 1)] : null;
   const control =
      'flex size-12 items-center justify-center rounded-full border border-paper/35 bg-black-block/55 text-paper transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease)] hover:bg-black-block/75 active:scale-[0.96]';

   return (
      <div className="relative bg-black-block text-paper">
         {current ? (
            /*
             * The record is the one screen where the untouched original is the
             * point, so this is the only photograph in the product that is
             * allowed to ask for it: eager, high priority, and the full
             * resolution offered beside the two smaller copies so a phone on a
             * thin signal gets something on the screen first.
             *
             * The box keeps a floor under it while the bytes are coming. The
             * photograph's own ratio is not known until it arrives, and
             * without a floor everything below the hero started at the top of
             * the screen and was thrown down the page a moment later.
             */
            <Img
               src={current.url}
               cardSrc={current.cardUrl}
               thumbSrc={current.thumbUrl}
               alt={`${title}, photo ${Math.min(index, count - 1) + 1} of ${count}`}
               priority
               full
               fit="contain"
               sizes="100vw"
               className="min-h-[320px] bg-black-block md:min-h-[380px]"
               imgClassName={cn(
                  'mx-auto max-h-[78dvh] transition-[opacity,transform] duration-[1800ms] [transition-timing-function:var(--ease)]',
                  built ? 'scale-100' : 'scale-105'
               )}
            />
         ) : (
            /*
             * No photograph. The house fish sits where the picture would be,
             * well above the title band, so nothing reads through the name.
             * The sentence used to sit at the bottom, under the title, and
             * the two printed over each other.
             */
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-4 pb-24 md:min-h-[380px]">
               <FishMark className="h-12 w-20 text-paper/20" />
               <p className="lab text-paper-2/70">No photo of this catch</p>
            </div>
         )}

         <div
            className="pointer-events-none absolute inset-0 scrim-photo"
            aria-hidden="true"
         />

         <button
            type="button"
            onClick={onBack}
            aria-label="Back to my catches"
            className={cn(control, 'absolute top-3 left-3 z-10')}
         >
            <ChevronLeftIcon
               className="size-6"
               strokeWidth={1.5}
               aria-hidden="true"
            />
         </button>

         {count > 1 ? (
            <>
               <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => onIndexChange((index - 1 + count) % count)}
                  className={cn(
                     control,
                     'absolute top-1/2 left-3 z-10 -translate-y-1/2'
                  )}
               >
                  <ChevronLeftIcon
                     className="size-6"
                     strokeWidth={1.5}
                     aria-hidden="true"
                  />
               </button>
               <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => onIndexChange((index + 1) % count)}
                  className={cn(
                     control,
                     'absolute top-1/2 right-3 z-10 -translate-y-1/2'
                  )}
               >
                  <ChevronRightIcon
                     className="size-6"
                     strokeWidth={1.5}
                     aria-hidden="true"
                  />
               </button>
               <span
                  className="lab num absolute top-6 right-4 z-10 text-paper-2"
                  aria-live="polite"
               >
                  {Math.min(index, count - 1) + 1} of {count}
               </span>
            </>
         ) : null}

         <div className="absolute inset-x-4 bottom-5 z-10 flex flex-col gap-1 md:inset-x-8 md:bottom-8">
            <span className="lab text-paper-2">{eyebrow}</span>
            <h1 className="g text-[64px] break-words text-paper md:text-[84px]">
               {title}
            </h1>
            <div className="g num text-[30px] tracking-[0.03em] text-paper md:text-[34px]">
               {headline}
            </div>
         </div>
      </div>
   );
}
