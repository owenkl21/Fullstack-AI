import { useState } from 'react';
import { BadgeChip } from '@/components/badges/Badge';
import { BadgeControl } from '@/components/badges/BadgePicker';
import type { CatchBadge } from '@/components/badges/badges-api';
import { BADGES, knownBadges, type BadgeKind } from '@/components/badges/kinds';
import { formatStamp } from '@/components/fishing/record/format';
import { isAdminSession, useSession } from '@/lib/auth-client';

/*
 * The badges on the record, where there is room to say the whole thing: the
 * mark at sixty four pixels, what it is called, who gave it and when, and the
 * team's line about the fish when they wrote one.
 *
 * It holds the badges itself, seeded from the record it was drawn with, so the
 * team can pin one and see it land without the page fetching the catch again.
 * The caller keys it by the catch id, which is what resets it when the reader
 * moves to another fish.
 */
export function CatchBadges({
   catchId,
   fishName,
   initial,
}: {
   catchId: string;
   fishName: string;
   initial: CatchBadge[];
}) {
   const { data } = useSession();
   const [badges, setBadges] = useState(initial);
   const [landed, setLanded] = useState<BadgeKind | null>(null);

   /*
    * The heading is drawn for the team even on a fish with nothing on it yet,
    * because that is where their control lives. For everybody else a record
    * with no badges has no section at all, and the session flag decides
    * nothing but that: the routes behind the control check the role
    * themselves, every time.
    */
   const team = isAdminSession(data?.user);
   /* A kind this build cannot draw is left out rather than looked up blindly;
      see knownBadges. */
   const drawable = knownBadges(badges);
   if (drawable.length === 0 && !team) return null;

   return (
      <section
         id="from-the-team"
         aria-labelledby="from-the-team-title"
         className="px-4 pt-6 md:px-8"
      >
         <div className="flex flex-wrap items-center justify-between gap-x-4">
            <h2 id="from-the-team-title" className="g text-[30px]">
               From the team
            </h2>
            <BadgeControl
               catchId={catchId}
               fishName={fishName}
               badges={badges}
               onChange={(next, justLanded) => {
                  setBadges(next);
                  setLanded(justLanded);
               }}
               tone="light"
               className="text-[19px]"
            />
         </div>

         {drawable.length === 0 ? (
            <p className="mt-1 max-w-[62ch] text-[15px] text-ink-2">
               Nothing on this one yet.
            </p>
         ) : (
            <ul className="mt-2">
               {drawable.map((badge) => {
                  const kind = BADGES[badge.kind];
                  const given = formatStamp(badge.createdAt);
                  return (
                     <li
                        key={badge.id}
                        className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-4 border-t border-line py-4 md:gap-6"
                     >
                        <BadgeChip
                           kind={badge.kind}
                           size="big"
                           landed={landed === badge.kind}
                        />
                        <div className="min-w-0">
                           <p className="g text-[26px] text-ink">{kind.name}</p>
                           <p className="text-[15px] text-ink-2">{kind.line}</p>
                           <p className="mt-1 text-[14px] text-ink-3">
                              {[
                                 `Given by ${badge.awardedBy?.displayName ?? 'the Fisherfeed team'}`,
                                 given,
                              ]
                                 .filter(Boolean)
                                 .join(' · ')}
                           </p>
                           {badge.note ? (
                              <p className="rule-dashed-left mt-2 max-w-[62ch] py-1 pl-3.5 text-[15px] text-ink-2">
                                 {badge.note}
                              </p>
                           ) : null}
                        </div>
                     </li>
                  );
               })}
            </ul>
         )}
      </section>
   );
}
