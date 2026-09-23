import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { VerifiedMark } from '@/components/profile/VerifiedMark';
import {
   addTeam,
   assignTeam,
   leadingFigure,
   removeTeam,
   renameTeam,
   teamRefusal,
   type Competition,
   type CompetitionTeam,
   type TeamMember,
   type TeamStanding,
} from '@/components/social/competitions-api';
import { cn } from '@/lib/utils';
import { type UnitChoice } from '@/lib/units';

/*
 * Teams in a competition: choosing a side, the board for the sides, and the
 * organiser's hand on them.
 *
 * A side is chosen from a sheet rather than a dropdown: each side shows who is
 * already on it and how much room it has, which is most of how a person picks
 * one. The server decides every rule (full, settled at the start, only the
 * organiser moves people); this only says what it said.
 */

/* How full a side is, in words. */
const roomWords = (count: number, cap: number | null | undefined) =>
   cap
      ? count >= cap
         ? `${count} of ${cap}, full`
         : `${count} of ${cap}`
      : count === 1
        ? '1 angler'
        : `${count} anglers`;

export function TeamPicker({
   open,
   onOpenChange,
   competition: c,
   teams,
   current,
   onPick,
}: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   competition: Competition;
   teams: CompetitionTeam[];
   /* The side the viewer is on now, if any. */
   current: string | null;
   onPick: (teamId: string) => Promise<void>;
}) {
   const [busy, setBusy] = useState<string | null>(null);

   return (
      <Sheet
         open={open}
         onOpenChange={onOpenChange}
         title={current ? 'Change team' : 'Pick a team'}
      >
         <div className="flex flex-col gap-4 p-4 md:mx-auto md:w-full md:max-w-[560px]">
            <div>
               <h2 className="g text-[26px]">
                  {current ? 'Change team' : 'Pick a team'}
               </h2>
               <p className="mt-1 text-[15px] text-ink-2">
                  {c.status === 'upcoming'
                     ? 'You can change your mind until it starts.'
                     : 'Teams are settled now, so this is the side you fish for.'}
               </p>
            </div>
            <ul className="flex flex-col border-t border-line">
               {teams.map((team) => {
                  const full = Boolean(
                     c.maxPerTeam &&
                     team.members.length >= c.maxPerTeam &&
                     team.id !== current
                  );
                  const yours = team.id === current;
                  return (
                     <li key={team.id} className="border-b border-line">
                        <button
                           type="button"
                           disabled={full || yours || busy !== null}
                           onClick={async () => {
                              setBusy(team.id);
                              try {
                                 await onPick(team.id);
                                 onOpenChange(false);
                              } catch {
                                 /* Said by the page; the sheet stays. */
                              } finally {
                                 setBusy(null);
                              }
                           }}
                           className={cn(
                              'flex min-h-[64px] w-full items-center gap-4 px-1 py-3 text-left transition-colors disabled:cursor-default',
                              yours
                                 ? 'text-teal-text'
                                 : full
                                   ? 'text-ink-3'
                                   : 'hover:bg-bg-2'
                           )}
                        >
                           <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="g-tracked truncate text-[20px]">
                                 {team.name}
                              </span>
                              <span className="truncate text-[14px] text-ink-2">
                                 {team.members.length
                                    ? team.members
                                         .map((m) => m.displayName)
                                         .join(', ')
                                    : 'Nobody yet'}
                              </span>
                           </span>
                           <span className="num shrink-0 text-[14px] text-ink-2">
                              {roomWords(team.members.length, c.maxPerTeam)}
                           </span>
                           <span className="lab w-[64px] shrink-0 text-right">
                              {yours
                                 ? 'Yours'
                                 : busy === team.id
                                   ? 'Joining'
                                   : full
                                     ? 'Full'
                                     : 'Join'}
                           </span>
                        </button>
                     </li>
                  );
               })}
            </ul>
         </div>
      </Sheet>
   );
}

/* The board for the sides, drawn like the board for the anglers. */
export function TeamBoard({
   competition: c,
   standings,
   units,
   yourTeamId,
}: {
   competition: Competition;
   standings: TeamStanding[];
   units: UnitChoice;
   yourTeamId: string | null;
}) {
   return (
      <div className="flex flex-col">
         {standings.map((t) => {
            const best =
               t.best && c.rule !== 'SPECIES_VARIETY'
                  ? `${t.best.displayName}${t.best.speciesName ? `, ${t.best.speciesName}` : ''}`
                  : null;
            const sub =
               c.rule === 'SPECIES_VARIETY'
                  ? `${t.members === 1 ? '1 angler' : `${t.members} anglers`}`
                  : best
                    ? `Best: ${best}`
                    : `${t.members === 1 ? '1 angler' : `${t.members} anglers`}, no fish yet`;
            return (
               <div
                  key={t.teamId}
                  className={cn(
                     'flex h-14 items-center gap-3.5 border-b border-line lg:h-[60px] lg:gap-4',
                     t.teamId === yourTeamId &&
                        'border-l-[3px] border-l-teal pl-2.5'
                  )}
               >
                  {/* A side with nothing on the board has no place yet: every
                      one of them "1st" at nought says a race is on that has
                      not started. */}
                  <span className="g num w-6 shrink-0 text-[28px] leading-none lg:w-7 lg:text-[30px]">
                     {t.score > 0 ? t.place : ''}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                     <span className="truncate text-[15px] font-semibold lg:text-[16px]">
                        {t.name}
                        {t.teamId === yourTeamId ? (
                           <span className="lab ml-2 text-teal-text">
                              Yours
                           </span>
                        ) : null}
                     </span>
                     <span className="truncate text-[14px] text-ink-2">
                        {sub}
                     </span>
                  </span>
                  <span
                     className={cn(
                        'g num shrink-0 text-[24px] leading-none tracking-[0.03em] lg:text-[26px]',
                        t.score > 0 ? '' : 'text-ink-3'
                     )}
                  >
                     {leadingFigure(c, t.score, units) ?? '0'}
                  </span>
               </div>
            );
         })}
      </div>
   );
}

/*
 * Who is on which side. Everybody sees the sides; the organiser, before the
 * start, also gets to rename one, add one, take an empty one away and move
 * somebody from one side to another.
 */
export function TeamRoster({
   competition: c,
   teams,
   unassigned,
   organise,
   onChanged,
}: {
   competition: Competition;
   teams: CompetitionTeam[];
   unassigned: TeamMember[];
   organise: boolean;
   onChanged: () => Promise<void>;
}) {
   const open = organise && c.status === 'upcoming';
   const [editing, setEditing] = useState<string | null>(null);
   const [draft, setDraft] = useState('');
   const [adding, setAdding] = useState('');
   const [busy, setBusy] = useState<string | null>(null);

   const run = async (key: string, work: () => Promise<unknown>) => {
      setBusy(key);
      try {
         await work();
         await onChanged();
         return true;
      } catch (error) {
         toast({
            title: 'That did not go through.',
            description: teamRefusal(error),
            variant: 'error',
         });
         return false;
      } finally {
         setBusy(null);
      }
   };

   const everyone = [
      ...teams.flatMap((t) => t.members.map((m) => ({ ...m, teamId: t.id }))),
      ...unassigned.map((m) => ({ ...m, teamId: null as string | null })),
   ];

   return (
      <section aria-labelledby="teams-heading">
         <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="teams-heading" className="g text-[26px] lg:text-[28px]">
               Teams
            </h2>
            <span className="lab num">
               {teams.length} teams
               {c.maxPerTeam ? ` · up to ${c.maxPerTeam} each` : ''}
            </span>
         </div>
         {open ? (
            <p className="mt-1 text-[14px] text-ink-2">
               Rename a team, add one, or move somebody across, until it starts.
            </p>
         ) : null}

         <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
               <li key={team.id} className="border border-line px-4 py-3">
                  {editing === team.id ? (
                     <form
                        className="flex gap-2"
                        onSubmit={async (event) => {
                           event.preventDefault();
                           const ok = await run(`rename:${team.id}`, () =>
                              renameTeam(c.id, team.id, draft.trim())
                           );
                           if (ok) setEditing(null);
                        }}
                     >
                        <input
                           value={draft}
                           onChange={(e) => setDraft(e.target.value)}
                           maxLength={40}
                           autoFocus
                           aria-label={`New name for ${team.name}`}
                           className="input-line h-11 min-w-0 flex-1 text-[16px]"
                        />
                        <Button
                           type="submit"
                           disabled={!draft.trim() || busy !== null}
                        >
                           Save
                        </Button>
                        <Button
                           type="button"
                           variant="outline"
                           onClick={() => setEditing(null)}
                        >
                           Cancel
                        </Button>
                     </form>
                  ) : (
                     <div className="flex items-center justify-between gap-3">
                        <span className="g-tracked truncate text-[20px]">
                           {team.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                           <span className="num text-[14px] text-ink-2">
                              {roomWords(team.members.length, c.maxPerTeam)}
                           </span>
                           {organise ? (
                              <button
                                 type="button"
                                 onClick={() => {
                                    setEditing(team.id);
                                    setDraft(team.name);
                                 }}
                                 className="g-tracked inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
                              >
                                 Rename
                              </button>
                           ) : null}
                           {open &&
                           team.members.length === 0 &&
                           teams.length > 2 ? (
                              <button
                                 type="button"
                                 disabled={busy !== null}
                                 onClick={() =>
                                    void run(`remove:${team.id}`, () =>
                                       removeTeam(c.id, team.id)
                                    )
                                 }
                                 className="g-tracked inline-flex min-h-11 items-center text-[15px] text-ink-2 hover:text-ink"
                              >
                                 Remove
                              </button>
                           ) : null}
                        </span>
                     </div>
                  )}

                  <ul className="mt-2 flex flex-col gap-1">
                     {team.members.length === 0 ? (
                        <li className="flex min-h-11 items-center text-[14px] text-ink-3">
                           Nobody yet
                        </li>
                     ) : (
                        team.members.map((member) => (
                           <li
                              key={member.id}
                              className="flex min-h-11 items-center justify-between gap-3 text-[15px]"
                           >
                              <Link
                                 to={`/anglers/${member.id}`}
                                 className="inline-flex min-h-11 min-w-0 items-center truncate hover:text-teal-text"
                              >
                                 {member.displayName}
                                 {member.verified ? <VerifiedMark /> : null}
                              </Link>
                           </li>
                        ))
                     )}
                  </ul>
               </li>
            ))}
         </ul>

         {open ? (
            <div className="mt-4 flex flex-col gap-4">
               <form
                  className="flex max-w-[420px] gap-2"
                  onSubmit={async (event) => {
                     event.preventDefault();
                     const ok = await run('add', () =>
                        addTeam(c.id, adding.trim())
                     );
                     if (ok) setAdding('');
                  }}
               >
                  <input
                     value={adding}
                     onChange={(e) => setAdding(e.target.value)}
                     maxLength={40}
                     placeholder="New team name"
                     aria-label="New team name"
                     className="input-line h-11 min-w-0 flex-1 text-[16px]"
                  />
                  <Button
                     type="submit"
                     variant="outline"
                     disabled={
                        !adding.trim() || busy !== null || teams.length >= 8
                     }
                  >
                     Add team
                  </Button>
               </form>

               {everyone.length ? (
                  <div>
                     <span className="lab">Move somebody</span>
                     <ul className="mt-2 flex flex-col border-t border-line">
                        {everyone.map((member) => (
                           <li
                              key={member.id}
                              className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line"
                           >
                              <span className="min-w-0 truncate text-[15px]">
                                 {member.displayName}
                              </span>
                              <select
                                 value={member.teamId ?? ''}
                                 disabled={busy !== null}
                                 aria-label={`Team for ${member.displayName}`}
                                 onChange={(event) => {
                                    const teamId = event.target.value;
                                    if (!teamId) return;
                                    void run(`move:${member.id}`, () =>
                                       assignTeam(c.id, member.id, teamId)
                                    );
                                 }}
                                 className="input-line h-11 w-[180px] shrink-0 text-[15px]"
                              >
                                 {member.teamId ? null : (
                                    <option value="">No team</option>
                                 )}
                                 {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                       {team.name}
                                    </option>
                                 ))}
                              </select>
                           </li>
                        ))}
                     </ul>
                  </div>
               ) : null}
            </div>
         ) : unassigned.length && organise ? (
            <p className="mt-3 text-[14px] text-ink-2">
               {unassigned.map((m) => m.displayName).join(', ')}{' '}
               {unassigned.length === 1 ? 'has' : 'have'} no team.
            </p>
         ) : null}
      </section>
   );
}
