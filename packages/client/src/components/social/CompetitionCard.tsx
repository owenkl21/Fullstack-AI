import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
   anglerWords,
   clockWords,
   dateSpan,
   leadingFigure,
   ruleWords,
   scopeLabel,
   statusLabel,
   whereWords,
   type Competition,
} from '@/components/social/competitions-api';
import { type UnitSystem } from '@/lib/units';
import { cn } from '@/lib/utils';

/*
 * One competition on the list.
 *
 * Six lines and one action: what state it is in and how long it has, what it
 * is called, how it is won, where and when, who is in front, and the single
 * thing this angler can do about it. The chips and the "on the board" heading
 * that used to sit above these are gone; the status is a line of type now.
 *
 * On a phone the cards are divided by hairlines in one column. On a desktop
 * each card is boxed and two sit to a row, so the footer is pushed to the
 * bottom of the box rather than left floating under a short card.
 */
export function CompetitionCard({
   competition,
   units,
   first,
   onEnter,
   onAccept,
}: {
   competition: Competition;
   units: UnitSystem;
   /* The first card sits closer to the wave than the ones under it. */
   first?: boolean;
   onEnter: () => void;
   onAccept: () => void;
}) {
   /* The clock, for the time left, once a minute. */
   const [now, setNow] = useState(() => Date.now());
   useEffect(() => {
      if (competition.status !== 'running') return;
      const timer = window.setInterval(() => setNow(Date.now()), 60000);
      return () => window.clearInterval(timer);
   }, [competition.status]);

   const to = `/competitions/${competition.id}`;
   const running = competition.status === 'running';
   const finished = competition.status === 'finished';
   const leading = competition.leading
      ? leadingFigure(competition, competition.leading.value, units)
      : null;

   /* One action, chosen in the order the design reads the card in: an
      invitation to answer first, then results to read, then the way in. */
   const action = competition.invite ? (
      <Button
         type="button"
         size="sm"
         className="px-4 text-[15px]"
         onClick={onAccept}
      >
         Accept invite
      </Button>
   ) : finished ? (
      <Button asChild variant="outline" size="sm" className="px-4 text-[15px]">
         <Link to={to}>View results</Link>
      </Button>
   ) : competition.youEntered ? (
      <Button asChild variant="outline" size="sm" className="px-4 text-[15px]">
         <Link to={to}>Entered · View</Link>
      </Button>
   ) : competition.scope === 'PUBLIC' ? (
      <Button
         type="button"
         variant="outline"
         size="sm"
         className="px-4 text-[15px]"
         onClick={onEnter}
      >
         Enter
      </Button>
   ) : (
      <Button asChild variant="outline" size="sm" className="px-4 text-[15px]">
         <Link to={to}>View</Link>
      </Button>
   );

   return (
      <li
         className={cn(
            'flex flex-col gap-1.5 border-line',
            'max-md:border-b max-md:last:border-b-0',
            'md:h-full md:border md:p-[22px_24px]',
            first ? 'max-md:pt-2 max-md:pb-[22px]' : 'max-md:py-[22px]'
         )}
      >
         <div className="flex items-center justify-between gap-3">
            <span className={cn('lab truncate', running && 'text-ink')}>
               {statusLabel(competition.status)} ·{' '}
               {scopeLabel(competition.scope)}
            </span>
            <span className="lab num shrink-0">
               {clockWords(competition, now)}
            </span>
         </div>

         <Link
            to={to}
            className="g mt-1.5 block truncate text-[30px] hover:text-teal-text md:mt-2 md:text-[32px]"
         >
            {competition.name}
         </Link>

         <p className="text-[15px] leading-[1.5] text-ink-2">
            {ruleWords(competition)}
            <br />
            {whereWords(competition)} ·{' '}
            <span className="num">
               {dateSpan(competition.startsAt, competition.endsAt)}
            </span>
         </p>

         {competition.leading && leading ? (
            <p className="mt-1.5 flex items-baseline gap-2.5 md:mt-2">
               <span className="lab shrink-0">
                  {finished ? 'Winner' : 'Leading'}
               </span>
               <span className="g-tracked num truncate text-[20px] tracking-[0.03em]">
                  {competition.rule !== 'SPECIES_VARIETY' &&
                  competition.leading.speciesName
                     ? `${competition.leading.speciesName} ${leading}`
                     : leading}
               </span>
               <span className="truncate text-[14px] text-ink-2">
                  {competition.leading.displayName}
               </span>
            </p>
         ) : null}

         <div className="mt-2.5 flex items-center justify-between gap-3 md:mt-auto md:pt-3.5">
            <span className="num truncate text-[14px] text-ink-3">
               {anglerWords(competition.entrantCount)}
               {competition.youOrganise ? ' · you organise' : ''}
            </span>
            {action}
         </div>
      </li>
   );
}
