import { useId } from 'react';
import { cn } from '@/lib/utils';
import { FixAccuracy } from './Counter';
import {
   conditionLines,
   conditionsNote,
   demoMoment,
   receiptNote,
   speciesChips,
} from './data';
import type { Demo } from './useDemo';

const CHIP =
   'g-tracked inline-flex h-[38px] items-center border border-ink px-3.5 text-[19px] transition-[background-color,color] duration-200';
const UNIT_CHIP =
   'g-tracked inline-flex h-[30px] items-center border border-ink px-2.5 text-[16px]';

/* Tapping Log stamps the clock, starts the fix and pulls the conditions while the sheet
 * is still rising. Nothing here is typed unless the angler wants it typed. */
export function LogSheet({ demo }: { demo: Demo }) {
   const speciesLabel = useId();
   const lengthLabel = useId();
   const weightLabel = useId();

   const lines = [
      ...conditionLines.map((c) => ({ ...c, note: false })),
      { key: '', value: conditionsNote, note: true },
   ];

   return (
      <>
         <div
            aria-hidden="true"
            onClick={demo.closeSheet}
            className={cn(
               'absolute inset-0 z-[6] bg-black-block/55 transition-opacity duration-[350ms]',
               demo.sheetOpen
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-none opacity-0'
            )}
         />
         <div
            role="group"
            aria-label="Log a catch"
            inert={!demo.sheetOpen}
            className={cn(
               'absolute inset-x-0 bottom-0 z-[7] flex h-[91%] flex-col border-t-[3px] border-teal bg-background text-foreground',
               demo.sheetOpen ? 'translate-y-0' : 'translate-y-[104%]'
            )}
            style={{ transition: 'transform 0.46s var(--ease)' }}
         >
            <div className="flex items-center justify-between border-b border-line py-2 pr-2.5 pl-[18px]">
               <span className="g text-[26px]">Log a catch</span>
               <div>
                  <button
                     type="button"
                     onClick={demo.nothingCaught}
                     className="g-tracked p-2 text-[18px] text-ink-2"
                  >
                     Nothing caught?
                  </button>
                  <button
                     type="button"
                     onClick={demo.closeSheet}
                     className="g-tracked p-2 text-[18px] text-ink-2"
                  >
                     Close
                  </button>
               </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[18px] pt-3.5 pb-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
               <div
                  aria-live="polite"
                  className="flex flex-col gap-1.5 border-l-[3px] border-dashed border-teal bg-bg-2 px-3.5 py-3"
               >
                  <span className="g num text-[40px] leading-none tracking-[0.03em]">
                     {demoMoment.time}
                  </span>
                  <div className={cn('fixline', demo.fixRunning && 'go')} />
                  <span className="num flex justify-between text-[14px]">
                     <span
                        className={demo.coordsIn ? 'text-ink' : 'text-ink-3'}
                     >
                        {demo.coordsIn ? demoMoment.coords : 'Getting a fix'}
                     </span>
                     <span
                        className={cn(
                           'min-w-[56px] text-right font-medium',
                           demo.fixDone ? 'text-ink' : 'text-teal-text'
                        )}
                     >
                        <FixAccuracy running={demo.fixRunning} />
                     </span>
                  </span>
                  <span className="text-[12px] text-ink-3">{receiptNote}</span>
               </div>

               <div className="flex flex-col gap-1">
                  {lines.map((line, i) => (
                     <div
                        key={line.note ? 'note' : line.key}
                        className={cn(
                           'flex gap-3 text-[14px]',
                           line.note
                              ? 'justify-start text-[12px] text-ink-3'
                              : 'items-baseline justify-between',
                           demo.condsIn > i
                              ? 'translate-y-0 opacity-100'
                              : 'translate-y-[6px] opacity-0'
                        )}
                        style={{
                           transition:
                              'opacity 0.4s, transform 0.5s var(--ease)',
                        }}
                     >
                        {line.note ? null : (
                           <span className="lab text-[11px]">{line.key}</span>
                        )}
                        <span className={line.note ? undefined : 'font-medium'}>
                           {line.value}
                        </span>
                     </div>
                  ))}
               </div>

               <div className="relative flex h-[200px] items-center justify-center overflow-hidden bg-black-block">
                  <img
                     src={demoMoment.photo}
                     alt="A bass held against the sea"
                     loading="lazy"
                     className={cn(
                        'absolute inset-0 h-full w-full object-cover',
                        demo.hasPhoto
                           ? 'scale-100 opacity-100'
                           : 'scale-[1.04] opacity-0'
                     )}
                     style={{
                        transition: 'opacity 0.7s, transform 1.4s var(--ease)',
                     }}
                  />
                  {demo.hasPhoto ? (
                     <div
                        className="shutter pointer-events-none absolute inset-0 bg-paper opacity-0"
                        aria-hidden="true"
                     />
                  ) : null}
                  <button
                     type="button"
                     onClick={demo.takePhoto}
                     className={cn(
                        'g-tracked relative z-[1] flex h-11 items-center border border-paper/50 bg-black-block/45 px-5 text-[20px] text-paper transition-opacity',
                        demo.hasPhoto && 'pointer-events-none opacity-0'
                     )}
                  >
                     Take a photo
                  </button>
               </div>

               <div role="group" aria-labelledby={speciesLabel}>
                  <span
                     id={speciesLabel}
                     className="lab mb-2 block text-[11px]"
                  >
                     Species
                  </span>
                  <div className="flex flex-wrap gap-2">
                     {speciesChips.map((chip) => {
                        const on = demo.selectedSpecies === chip;
                        return (
                           <button
                              key={chip}
                              type="button"
                              aria-pressed={on}
                              onClick={() => demo.pickSpecies(chip)}
                              className={cn(
                                 CHIP,
                                 on && 'bg-ink text-background'
                              )}
                           >
                              {chip}
                           </button>
                        );
                     })}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div
                     className="rule-dashed flex flex-col gap-1.5 pt-2"
                     role="group"
                     aria-labelledby={lengthLabel}
                  >
                     <span id={lengthLabel} className="lab text-[11px]">
                        Length
                     </span>
                     <span className="g num flex items-baseline gap-1.5 text-[48px] leading-none tracking-[0.03em]">
                        {demo.lengthUnit === 'cm'
                           ? demoMoment.lengthCm
                           : demoMoment.lengthIn}
                        <small className="font-sans text-[14px] tracking-normal text-ink-2">
                           {demo.lengthUnit}
                        </small>
                     </span>
                     <span className="flex gap-1.5">
                        {(['cm', 'in'] as const).map((unit) => (
                           <button
                              key={unit}
                              type="button"
                              aria-pressed={demo.lengthUnit === unit}
                              onClick={() => demo.setLengthUnit(unit)}
                              className={cn(
                                 UNIT_CHIP,
                                 demo.lengthUnit === unit &&
                                    'bg-ink text-background'
                              )}
                           >
                              {unit}
                           </button>
                        ))}
                     </span>
                     <span
                        className={cn(
                           'flex items-center gap-2.5 text-[12px]',
                           demo.lengthTaped ? 'text-ink' : 'text-ink-3'
                        )}
                     >
                        <span>{demo.lengthTaped ? 'on a tape' : 'by eye'}</span>
                        <button
                           type="button"
                           onClick={() =>
                              demo.setLengthTaped(!demo.lengthTaped)
                           }
                           className="font-medium text-teal-text"
                        >
                           {demo.lengthTaped ? 'Undo' : 'On a tape'}
                        </button>
                     </span>
                  </div>

                  <div
                     className="rule-dashed flex flex-col gap-1.5 pt-2"
                     role="group"
                     aria-labelledby={weightLabel}
                  >
                     <span id={weightLabel} className="lab text-[11px]">
                        Weight
                     </span>
                     <span className="g num flex items-baseline gap-1.5 text-[48px] leading-none tracking-[0.03em]">
                        {demo.weightUnit === 'kg'
                           ? demoMoment.weightKg
                           : demoMoment.weightLb}
                        <small className="font-sans text-[14px] tracking-normal text-ink-2">
                           {demo.weightUnit}
                        </small>
                     </span>
                     <span className="flex gap-1.5">
                        {(['kg', 'lb'] as const).map((unit) => (
                           <button
                              key={unit}
                              type="button"
                              aria-pressed={demo.weightUnit === unit}
                              onClick={() => demo.setWeightUnit(unit)}
                              className={cn(
                                 UNIT_CHIP,
                                 demo.weightUnit === unit &&
                                    'bg-ink text-background'
                              )}
                           >
                              {unit}
                           </button>
                        ))}
                     </span>
                     <span
                        className={cn(
                           'flex items-center gap-2.5 text-[12px]',
                           demo.weightWeighed ? 'text-ink' : 'text-ink-3'
                        )}
                     >
                        <span>
                           {demo.weightWeighed ? 'on a scale' : 'by eye'}
                        </span>
                        <button
                           type="button"
                           onClick={() =>
                              demo.setWeightWeighed(!demo.weightWeighed)
                           }
                           className="font-medium text-teal-text"
                        >
                           {demo.weightWeighed ? 'Undo' : 'On a scale'}
                        </button>
                     </span>
                  </div>
               </div>
            </div>

            <button
               type="button"
               onClick={demo.save}
               className="g-tracked h-14 flex-none bg-teal text-[26px] tracking-[0.1em] text-teal-ink"
            >
               Save catch
            </button>
         </div>
      </>
   );
}
