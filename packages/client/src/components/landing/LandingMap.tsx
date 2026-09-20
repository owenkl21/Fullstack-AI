import { useRef, useState, type CSSProperties } from 'react';
import { TornEdge } from '@/components/brand/TornEdge';
import { Contours } from '@/components/brand/Contours';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP, stagger } from './layout';
import { photos } from './photos';
import { useParallaxFallback } from './useParallaxFallback';

/*
 * At the spot: the map, and who gets to see what is on it.
 *
 * The plate under the pins is drawn rather than loaded. A live Leaflet map on
 * the signed-out page would pull tiles, a library and an attribution bar for a
 * picture nobody pans, and a photograph of a coast dressed up as a map is a
 * lie about the product. So the geography is a flat sheet in the house
 * language: cool water, warm land, a coast hairline, the contour art the rest
 * of the page already uses, and the product's own pins standing on it.
 *
 * The pins are the app's, not a drawing of them. The teardrop, the small drop
 * and the kind colours are copied out of `src/lib/leaflet.ts`, where the map
 * builds its markers, so the vocabulary a reader learns here is the one they
 * meet the first time they open the map.
 */

/*
 * One pin shape, 36 wide and 46 tall, the tip standing on the position. Lifted
 * verbatim from `kindPin` in `src/lib/leaflet.ts`; if that shape ever changes,
 * this changes with it.
 */
const TEARDROP =
   'M18 45C18 45 3.5 28.6 3.5 18a14.5 14.5 0 1 1 29 0C32.5 28.6 18 45 18 45Z';

/* The quieter drop a private mark wears, 28 by 36. Also from leaflet.ts. */
const SMALL_DROP =
   'M14 35C14 35 3 22.4 3 14a11 11 0 1 1 22 0C25 22.4 14 35 14 35Z';

/*
 * The body colour of each kind, matching `BODY` in leaflet.ts kind for kind.
 *
 * Teal and paper are the tokens the product already names. The other four are
 * the map's own fixed inks: a pin sits on satellite imagery and has to hold
 * its colour whatever the page theme does, so the map does not let them move
 * and neither does this.
 */
const FILL = {
   spot: 'var(--teal)',
   other: '#14110f',
   waypoint: 'var(--paper)',
   ramp: '#1f6fb2',
   marina: '#1d3557',
   tackle: '#c97b1c',
} as const;

type PinKind = keyof typeof FILL;

function Pin({
   kind,
   count,
   stroke = 'var(--paper)',
   className,
}: {
   kind: PinKind;
   count?: number;
   stroke?: string;
   className?: string;
}) {
   const small = kind === 'waypoint';
   const w = small ? 28 : 36;
   const h = small ? 36 : 46;
   return (
      <svg
         viewBox={`0 0 ${w} ${h}`}
         aria-hidden="true"
         className={cn('block shrink-0', className)}
         style={{ aspectRatio: `${w} / ${h}` }}
      >
         <path
            d={small ? SMALL_DROP : TEARDROP}
            fill={FILL[kind]}
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
         />
         {count ? (
            <text
               x="18"
               y="18"
               textAnchor="middle"
               dominantBaseline="central"
               fontSize="20"
               fill="var(--teal-ink)"
               className="g num"
            >
               {count}
            </text>
         ) : null}
      </svg>
   );
}

/* Several spots at once: the doubled disc the map draws when pins collide. */
function ClusterPin({
   stroke = 'var(--paper)',
   className,
}: {
   stroke?: string;
   className?: string;
}) {
   return (
      <svg
         viewBox="0 0 48 48"
         aria-hidden="true"
         className={cn('block shrink-0', className)}
         style={{ aspectRatio: '1 / 1' }}
      >
         <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
         />
         <circle
            cx="24"
            cy="24"
            r="17"
            fill="var(--teal)"
            stroke="var(--paper)"
            strokeWidth="3"
         />
      </svg>
   );
}

/* What the pins mean, in the order the map's own legend lists them. */
const legend: { key: string; kind: PinKind | 'cluster'; label: string }[] = [
   { key: 'spot', kind: 'spot', label: 'Your spot, with its catch count' },
   { key: 'other', kind: 'other', label: "Another angler's public spot" },
   { key: 'waypoint', kind: 'waypoint', label: 'Your private mark' },
   { key: 'ramp', kind: 'ramp', label: 'Slipway' },
   { key: 'marina', kind: 'marina', label: 'Harbour or marina' },
   { key: 'tackle', kind: 'tackle', label: 'Tackle or bait shop' },
   { key: 'cluster', kind: 'cluster', label: 'Several spots, zoom in' },
];

/* How much of a mark anyone else is given. The whole argument of the section. */
const disclosures = [
   { value: 'exact', label: 'Exact' },
   { value: 'km', label: 'Within a km' },
   { value: 'off', label: 'Off the map' },
] as const;

type Disclosure = (typeof disclosures)[number]['value'];

/*
 * The coast, drawn well outside the box so the sheet's own edge is never
 * stroked: only the waterline between the two fills is a line.
 */
const COAST = [
   'M-6 -6 L18 -6 C22 6 14 14 16 24 C18 34 26 34 24 42 C22 50 28 52 27 60 C26 68 33 72 31 80 C29 88 36 94 34 106 L-6 106 Z',
   'M106 48 C96 54 90 60 88 66 C86 72 92 76 90 82 C88 88 80 90 82 106 L106 106 Z',
];

/* The graticule: four meridians and three parallels, barely there. */
const MERIDIANS = [20, 40, 60, 80];
const PARALLELS = [25, 50, 75];

/*
 * Where the pins stand, as a share of the plate. `mine` is a spot of your own,
 * which is the only thing the disclosure control moves.
 */
const marks: {
   key: string;
   kind: PinKind;
   count?: number;
   x: number;
   y: number;
   mine?: boolean;
}[] = [
   { key: 'tackle', kind: 'tackle', x: 9, y: 38 },
   { key: 'ramp', kind: 'ramp', x: 25, y: 57 },
   { key: 'marina', kind: 'marina', x: 34, y: 82 },
   { key: 'mine-a', kind: 'spot', count: 12, x: 34, y: 24, mine: true },
   { key: 'mine-b', kind: 'spot', count: 4, x: 48, y: 62, mine: true },
   { key: 'waypoint', kind: 'waypoint', x: 54, y: 14 },
   { key: 'other-a', kind: 'other', x: 63, y: 33 },
   { key: 'other-b', kind: 'other', x: 72, y: 88 },
];

export function LandingMap() {
   const band = useRef<HTMLDivElement>(null);
   useParallaxFallback(band, 0.18);
   const [shown, setShown] = useState<Disclosure>('exact');

   return (
      <section
         id="map"
         className={cn(
            'relative bg-black-block pt-[84px] pb-11 text-paper md:pt-[112px] md:pb-14',
            ANCHOR
         )}
      >
         <TornEdge fill="bg" flip seed={22} />
         {/* Its own clipping box, so the waterline at the foot can hang. */}
         <div className="absolute inset-0 overflow-hidden">
            <div
               ref={band}
               className="parallax-band absolute inset-x-0 top-[-14%] bottom-0"
            >
               <img
                  src={photos.rockOcean}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
               />
               <div className="absolute inset-0 bg-black-block/88" />
            </div>
         </div>

         <div className={cn(WRAP, 'relative')}>
            <div className="grid items-start gap-10 md:grid-cols-2 md:gap-12">
               <div className="flex min-w-0 flex-col gap-[18px]">
                  <span className="rv flex items-baseline gap-3.5">
                     <span className="g num text-[52px] leading-[0.8] text-teal">
                        02
                     </span>
                     <span className="lab text-paper-2">At the spot</span>
                     <span
                        aria-hidden="true"
                        className="block h-px flex-1 bg-paper/20"
                     />
                  </span>

                  <h2
                     className="g rv max-w-[14ch] text-[clamp(42px,5.4vw,76px)] [text-shadow:0_2px_20px_rgba(0,0,0,0.4)]"
                     style={stagger(1)}
                  >
                     Your marks stay yours
                  </h2>

                  <p
                     className="rv max-w-[48ch] text-[17px] text-pretty"
                     style={stagger(2)}
                  >
                     The map is where anyone decides where to fish, so it opens
                     on water corner to corner: your spots, the ones other
                     anglers have made public, your own private marks, and every
                     slipway, harbour and tackle shop around wherever you are
                     looking.
                  </p>

                  <p
                     className="rv max-w-[48ch] text-[17px] text-paper-2 text-pretty"
                     style={stagger(3)}
                  >
                     A mark you worked for is exact for you, blurred to about a
                     kilometre for everyone else, or off the map entirely. I am
                     not in the business of giving your spots away.
                  </p>

                  <div
                     role="radiogroup"
                     aria-label="Shown to others"
                     className="rv mt-1 flex flex-wrap self-start border border-paper"
                     style={stagger(3)}
                  >
                     {disclosures.map((option, i) => (
                        <button
                           key={option.value}
                           type="button"
                           role="radio"
                           aria-checked={shown === option.value}
                           onClick={() => setShown(option.value)}
                           className={cn(
                              'g-tracked flex h-11 items-center px-[18px] text-[17px] transition-colors duration-150 [transition-timing-function:var(--ease)]',
                              i > 0 && 'border-l border-paper/30',
                              shown === option.value
                                 ? 'bg-paper text-black-block'
                                 : 'text-paper-2 hover:text-paper'
                           )}
                        >
                           {option.label}
                        </button>
                     ))}
                  </div>
               </div>

               <div
                  className="blk blk-flat rv min-w-0 border border-paper/20 px-[22px] pt-6 pb-[26px]"
                  style={stagger(2)}
               >
                  <span className="lab text-paper-2">The pins</span>
                  <ul className="mt-3.5 flex flex-col">
                     {legend.map((row) => (
                        <li
                           key={row.key}
                           className="flex items-center gap-3.5 border-t border-paper/20 py-[9px]"
                        >
                           {row.kind === 'cluster' ? (
                              <ClusterPin
                                 stroke="var(--paper-2)"
                                 className="w-7"
                              />
                           ) : (
                              <Pin
                                 kind={row.kind}
                                 stroke="var(--paper-2)"
                                 className="w-6"
                              />
                           )}
                           <span className="text-[15px]">{row.label}</span>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>

            <div
               className="blk blk-flat blk-plain rv mt-10 border border-paper/20 md:mt-14"
               style={stagger(2)}
            >
               <div
                  aria-hidden="true"
                  className="relative aspect-[5/6] w-full overflow-hidden bg-black-block sm:aspect-[2/1] lg:aspect-[21/9]"
                  style={
                     {
                        /* The contour art is drawn for paper grounds; on the
                           plate it has to come back the other way up. */
                        '--contour':
                           'color-mix(in srgb, var(--paper) 15%, transparent)',
                     } as CSSProperties
                  }
               >
                  <svg
                     viewBox="0 0 100 100"
                     preserveAspectRatio="none"
                     className="absolute inset-0 h-full w-full"
                  >
                     <rect
                        x="0"
                        y="0"
                        width="100"
                        height="100"
                        fill="var(--teal)"
                        fillOpacity="0.08"
                     />
                     {COAST.map((d) => (
                        <path
                           key={d}
                           d={d}
                           fill="color-mix(in srgb, var(--paper) 6%, var(--black-2))"
                           stroke="var(--paper)"
                           strokeOpacity="0.3"
                           strokeWidth="1"
                           vectorEffect="non-scaling-stroke"
                        />
                     ))}
                     {MERIDIANS.map((x) => (
                        <line
                           key={`m${x}`}
                           x1={x}
                           y1="0"
                           x2={x}
                           y2="100"
                           stroke="var(--paper)"
                           strokeOpacity="0.08"
                           strokeWidth="1"
                           vectorEffect="non-scaling-stroke"
                        />
                     ))}
                     {PARALLELS.map((y) => (
                        <line
                           key={`p${y}`}
                           x1="0"
                           y1={y}
                           x2="100"
                           y2={y}
                           stroke="var(--paper)"
                           strokeOpacity="0.08"
                           strokeWidth="1"
                           vectorEffect="non-scaling-stroke"
                        />
                     ))}
                  </svg>

                  <Contours seed={9} className="inset-0 h-full w-full" />

                  {marks.map((mark) => (
                     <span key={mark.key}>
                        {mark.mine ? (
                           <svg
                              viewBox="0 0 100 100"
                              className={cn(
                                 'absolute h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 lg:h-[104px] lg:w-[104px]',
                                 shown === 'km' ? 'opacity-100' : 'opacity-0'
                              )}
                              style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
                           >
                              <circle
                                 cx="50"
                                 cy="50"
                                 r="47"
                                 fill="var(--teal)"
                                 fillOpacity="0.12"
                                 stroke="var(--teal)"
                                 strokeOpacity="0.55"
                                 strokeWidth="1.5"
                                 strokeDasharray="4 3"
                              />
                           </svg>
                        ) : null}
                        <span
                           className={cn(
                              'absolute -translate-x-1/2 -translate-y-full transition-opacity duration-300',
                              mark.mine && shown === 'off' && 'opacity-0'
                           )}
                           style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
                        >
                           <Pin
                              kind={mark.kind}
                              count={mark.count}
                              className="w-[30px] lg:w-9"
                           />
                        </span>
                     </span>
                  ))}

                  <span
                     className="absolute -translate-x-1/2 -translate-y-1/2"
                     style={{ left: '82%', top: '46%' }}
                  >
                     <ClusterPin className="w-8 lg:w-10" />
                  </span>

                  <span className="absolute bottom-3 left-3 flex items-end gap-2">
                     <span className="block h-2 w-14 border-x border-b border-paper/40" />
                     <span className="lab text-paper-2">1 km</span>
                  </span>
                  <span className="num lab absolute right-3 bottom-3 hidden text-paper-2 sm:block">
                     -34.12770, 18.44860
                  </span>
               </div>

               <div className="flex flex-wrap gap-2 border-t border-paper/20 px-[18px] py-4 md:px-[22px]">
                  <span className="g-tracked inline-flex h-11 items-center border border-paper/20 bg-black-block-2 px-3.5 text-[15px]">
                     Satellite
                     <span className="num ml-1.5 text-paper-2">3 on</span>
                  </span>
                  <span className="g-tracked inline-flex h-11 items-center border border-teal bg-teal px-3.5 text-[15px] text-black-block">
                     Drop a mark
                  </span>
                  <span className="g-tracked inline-flex h-11 items-center border border-paper/20 bg-black-block-2 px-3.5 text-[15px]">
                     Locate
                  </span>
                  <span className="g-tracked inline-flex h-11 items-center border border-paper/20 bg-black-block-2 px-3.5 text-[15px]">
                     Log here
                  </span>
               </div>

               <p className="px-[18px] pb-[18px] text-[13px] text-paper-2 md:px-[22px]">
                  Tap a pin for what is there. Press and hold anywhere to drop a
                  mark of your own.
               </p>
            </div>
         </div>

         <TornEdge fill="black" cut />
      </section>
   );
}
