import { createRoot } from 'react-dom/client';
import type { ComponentType, SVGProps } from 'react';
import {
   ArrowDownRightIcon,
   BuildingStorefrontIcon,
   CalendarIcon,
   CameraIcon,
   FlagIcon,
   LifebuoyIcon,
   MapPinIcon,
   PencilSquareIcon,
   TruckIcon,
   UserIcon,
} from '@heroicons/react/24/outline';
import { FishMark } from '@/components/brand/FishMark';
import { plural } from '@/components/fishing/record/format';
import type { SpotRating } from '@/components/fishing/reviews/reviews-api';
import { Stars } from '@/components/fishing/reviews/Stars';
import { cn } from '@/lib/utils';

/*
 * The card that opens on a pin.
 *
 * Leaflet owns the popup's DOM, so the card is a React tree mounted into
 * an element Leaflet is handed. That way the marks are the same Heroicons
 * components the rest of the product uses, and the fish is the brand's own
 * mark, rather than anything drawn by hand here.
 */

export type PopupMark =
   | 'fish'
   | 'calendar'
   | 'user'
   | 'pin'
   | 'note'
   | 'flag'
   | 'ramp'
   | 'anchor'
   | 'hook'
   | 'parking'
   | 'camera';

const MARKS: Record<PopupMark, ComponentType<SVGProps<SVGSVGElement>>> = {
   fish: FishMark,
   calendar: CalendarIcon,
   user: UserIcon,
   pin: MapPinIcon,
   note: PencilSquareIcon,
   flag: FlagIcon,
   ramp: ArrowDownRightIcon,
   anchor: LifebuoyIcon,
   hook: BuildingStorefrontIcon,
   parking: TruckIcon,
   camera: CameraIcon,
};

export type PopupFact = {
   mark: PopupMark;
   value: string;
   quiet?: boolean;
   /* Tabular figures, for coordinates that should not shift as they change. */
   figures?: boolean;
};

export type PopupAction = {
   label: string;
   onClick: (button: HTMLButtonElement) => void;
   tone?: 'primary' | 'plain' | 'danger';
};

export type PopupInput = {
   kicker: string;
   title: string;
   /* What anglers make of it, as the first line. Left out until someone has
      rated it, since the other facts are dropped when empty too. */
   rating?: SpotRating | null;
   facts: PopupFact[];
   /* Small words under the facts: what the spot is known for. */
   tags?: string[];
   actions?: PopupAction[];
   /* A stripe of the spot's own colour down the left. */
   accent?: string;
};

function Card({ input }: { input: PopupInput }) {
   const rating = input.rating;
   const average = rating && rating.count > 0 ? rating.average : null;

   return (
      <div
         className="map-card"
         style={
            input.accent
               ? ({ '--card-accent': input.accent } as React.CSSProperties)
               : undefined
         }
      >
         <p className="map-card-kicker">{input.kicker}</p>
         <p className="map-card-title">{input.title}</p>
         <ul className="map-card-facts">
            {rating && average !== null ? (
               <li className="map-card-fact">
                  <Stars value={average} className="gap-px [--star:16px]" />
                  <span className="num">
                     <span className="font-medium">{average.toFixed(1)}</span>
                     <span className="sr-only"> out of 5</span>{' '}
                     <span className="text-ink-2">
                        · {plural(rating.count, 'rating', 'ratings')}
                     </span>
                  </span>
               </li>
            ) : null}
            {input.facts
               .filter((fact) => fact.value)
               .map((fact, i) => {
                  const Mark = MARKS[fact.mark];
                  return (
                     <li
                        key={`${fact.mark}-${i}`}
                        className={cn(
                           'map-card-fact',
                           fact.quiet && 'quiet',
                           fact.figures && 'num'
                        )}
                     >
                        <Mark aria-hidden="true" className="map-card-mark" />
                        <span>{fact.value}</span>
                     </li>
                  );
               })}
         </ul>
         {input.tags?.length ? (
            <ul className="map-card-tags">
               {input.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
               ))}
            </ul>
         ) : null}
         {input.actions?.length ? (
            <div className="map-card-actions">
               {input.actions.map((action) => (
                  <button
                     key={action.label}
                     type="button"
                     className={`map-card-act ${action.tone ?? 'plain'}`}
                     onClick={(event) => action.onClick(event.currentTarget)}
                  >
                     {action.label}
                  </button>
               ))}
            </div>
         ) : null}
      </div>
   );
}

/** An element Leaflet can bind as a popup, with the card rendered into it. */
export function popupCard(input: PopupInput): HTMLElement {
   const host = document.createElement('div');
   createRoot(host).render(<Card input={input} />);
   return host;
}
