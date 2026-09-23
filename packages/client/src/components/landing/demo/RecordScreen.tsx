import { cn } from '@/lib/utils';
import { Counter } from './Counter';
import {
   demoMoment,
   recordCells,
   recordConditions,
   recordPosition,
   recordProvenance,
} from './data';
import type { Demo } from './useDemo';

const CELL = 'rule-dashed flex flex-col pt-2';
const ACTION =
   'g-tracked inline-flex h-11 items-center border border-ink px-4 text-[20px]';

/* The record, assembling itself: the photo settles, the cells fade up in order, the
 * numbers count into place and the provenance line lands last. */
export function RecordScreen({ demo }: { demo: Demo }) {
   const built = demo.recordBuilt;
   const cellStyle = (delay: string) => ({
      transition: 'opacity 0.5s, transform 0.6s var(--ease)',
      transitionDelay: delay,
   });
   const shown = built
      ? 'translate-y-0 opacity-100'
      : 'translate-y-[10px] opacity-0';

   return (
      <>
         <div className="relative h-[400px] overflow-hidden bg-black-block text-paper">
            <img
               src={demoMoment.photo}
               alt="A bass held against the sea"
               loading="lazy"
               className={cn(
                  'h-full w-full object-cover',
                  built ? 'scale-100' : 'scale-[1.05]'
               )}
               style={{ transition: 'transform 1.8s var(--ease)' }}
            />
            <div className="scrim-hero absolute inset-0" />
            <button
               type="button"
               onClick={demo.goHome}
               className="g-tracked absolute top-[66px] left-3.5 z-[2] flex h-9 items-center border border-paper/35 bg-black-block/50 px-3 text-[18px] text-paper"
            >
               Catches
            </button>
            <div className="absolute right-[18px] bottom-5 left-[18px] z-[2]">
               <span className="lab block text-[11px] text-paper-2">
                  {demoMoment.date}, {demoMoment.time} · {demoMoment.spot}
               </span>
               <span className="g block text-[64px]">{demo.recordSpecies}</span>
               <div className="g num text-[34px] tracking-[0.03em]">
                  <Counter
                     to={44}
                     decimals={0}
                     duration={demo.recordCountMs}
                     token={demo.recordToken}
                  />{' '}
                  cm <i className="text-paper-2 not-italic">·</i>{' '}
                  <Counter
                     to={1.9}
                     decimals={1}
                     duration={demo.recordCountMs}
                     token={demo.recordToken}
                  />{' '}
                  kg
               </div>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 px-[18px] pt-[18px]">
            <div className={cn(CELL, shown)} style={cellStyle('0.05s')}>
               <span className="lab text-[11px]">{recordCells[0].key}</span>
               <span className="g num mt-1 text-[32px] leading-[1.05] tracking-[0.03em]">
                  <Counter
                     to={44}
                     decimals={0}
                     duration={demo.recordCountMs}
                     token={demo.recordToken}
                  />
                  <small className="ml-1 font-sans text-[13px] tracking-normal text-ink-2">
                     cm
                  </small>
               </span>
               <span className="text-[12px] text-ink-3">
                  {recordCells[0].under}
                  <b className="font-medium text-ink-2">
                     {recordCells[0].source}
                  </b>
               </span>
            </div>

            <div className={cn(CELL, shown)} style={cellStyle('0.15s')}>
               <span className="lab text-[11px]">{recordCells[1].key}</span>
               <span className="g num mt-1 text-[32px] leading-[1.05] tracking-[0.03em]">
                  <Counter
                     to={1.9}
                     decimals={1}
                     duration={demo.recordCountMs}
                     token={demo.recordToken}
                  />
                  <small className="ml-1 font-sans text-[13px] tracking-normal text-ink-2">
                     kg
                  </small>
               </span>
               <span className="text-[12px] text-ink-3">
                  {recordCells[1].under}
                  <b className="font-medium text-ink-2">
                     {recordCells[1].source}
                  </b>
               </span>
            </div>

            <div className={cn(CELL, shown)} style={cellStyle('0.25s')}>
               <span className="lab text-[11px]">{recordConditions.key}</span>
               <span className="g num mt-1 text-[22px] leading-[1.05] tracking-[0.03em]">
                  {recordConditions.value}
               </span>
               <span className="text-[12px] text-ink-3">
                  {recordConditions.under}
               </span>
            </div>

            <div className={cn(CELL, shown)} style={cellStyle('0.35s')}>
               <span className="lab text-[11px]">{recordPosition.key}</span>
               <span className="g num mt-1 text-[22px] leading-[1.05] tracking-[0.03em]">
                  {recordPosition.value}
               </span>
               <span className="text-[12px] text-ink-3">
                  {recordPosition.underBefore}
                  <b className="font-medium text-ink-2">
                     {recordPosition.underBold}
                  </b>
                  {recordPosition.underAfter}
               </span>
            </div>
         </div>

         <p
            className={cn(
               'mx-[18px] mt-[18px] border-l-[3px] border-dashed border-teal px-3.5 py-3 text-[13px] leading-[1.5] text-ink-2',
               built ? 'opacity-100' : 'opacity-0'
            )}
            style={{ transition: 'opacity 0.6s 0.5s' }}
         >
            {recordProvenance}
         </p>

         <div className="flex gap-2 px-[18px] pt-[18px] pb-6">
            <button
               type="button"
               onClick={demo.goHome}
               className={cn(ACTION, 'bg-ink text-background')}
            >
               Back to catches
            </button>
            <button type="button" className={ACTION}>
               Share
            </button>
         </div>
      </>
   );
}
