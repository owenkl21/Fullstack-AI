import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { isAdminSession, signOut, useSession } from '@/lib/auth-client';
import { forgetPushOnSignOut } from '@/lib/push';
import { initialOf } from '@/components/profile/types';
import { useMyAvatar } from '@/components/profile/avatar-api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/*
 * What <UserButton /> used to be, in the product's own language rather than a
 * vendor's. A round avatar that opens everything that is yours.
 *
 * It used to be a 224px box hanging off the avatar with 33px rows, which on a
 * phone covered half the feed and still read as cramped, and which was a div
 * with role="menu": no escape key, no focus held inside it, and the page
 * scrolling away behind it. It is now a panel from the right edge, full
 * height, on the app's own Sheet. Radix Dialog brings the overlay, the escape
 * key, the tap outside, the scroll lock and the focus.
 *
 * Round is the one exception the design rules allow to radius 0, alongside
 * avatars and round icon controls.
 */

/* Everything that is yours, in one list. Two of these had no way in from a
 * phone at all before: /sites/me was linked only from the desktop nav and a
 * spot page, and /competitions only from Boards.
 *
 * Find anglers sits under the profile because following people is part of
 * who you are here, and this panel is the one place that is the same on a
 * phone and a desktop. It is marked only on the search itself, not on every
 * angler it leads to. */
/*
 * Only what is not already a tap away. Each row says where it is needed: a
 * place the phone bar or the header already carries at that width is not
 * repeated here. The phone bar has Feed, Catches, Map and Forecast; the
 * header has every place from a desktop, the four wide words only from a
 * wide one; the bell is in the header everywhere, so Notifications is not
 * a row. `only` is the Tailwind that hides a row where it would repeat.
 */
type Row = { to: string; label: string; end?: boolean; only?: string };

const groups: { title: string; rows: Row[] }[] = [
   {
      title: 'Yours',
      rows: [
         { to: '/profile', label: 'Your profile' },
         { to: '/insights', label: 'Your insights' },
         /* In the header from a wide screen. */
         { to: '/sites/me', label: 'Your spots', only: 'xl:hidden' },
         { to: '/gear/me', label: 'Your gear', only: 'xl:hidden' },
         { to: '/saved', label: 'Kept posts, spots and gear' },
      ],
   },
   {
      title: 'Out there',
      rows: [
         /* On the phone bar; in the header from a wide screen. */
         {
            to: '/forecast',
            label: 'Forecast',
            only: 'max-md:hidden xl:hidden',
         },
         /* In the header from a tablet up. */
         { to: '/boards', label: 'Boards', only: 'md:hidden' },
         { to: '/competitions', label: 'Competitions', only: 'xl:hidden' },
         { to: '/anglers', label: 'Find anglers', end: true },
      ],
   },
];

const accountRow: Row = { to: '/account', label: 'Account' };

/*
 * The one row not everybody gets. The session says whether this account is the
 * one the app is run from, and that is enough to decide what to draw: the page
 * itself is decided by the server, which answers a stranger the same 404 it
 * answers for an address that is not there. So a flag that was somehow wrong
 * here would show a link to a page that still refuses.
 */
const adminRow: Row = {
   to: '/admin',
   label: 'Admin',
};

export function AccountMenu() {
   const { data } = useSession();
   const signedAvatar = useMyAvatar(Boolean(data?.user));
   const navigate = useNavigate();
   const [open, setOpen] = useState(false);

   if (!data?.user) {
      return null;
   }

   const user = data.user;
   /* The same two letters the profile shows, so the header and the page agree
    * and a lone O is not read as a nought. */
   const initial = initialOf(user.name || user.email || '?');
   /* The session's image may be a storage key; only a real address is shown. */
   const avatar =
      signedAvatar ??
      (user.image && /^https?:\/\//.test(user.image) ? user.image : null);
   /* The session carries the handle, so the panel head costs no request. */
   const handle = user.username ? `@${user.username}` : user.email;

   const leave = async () => {
      setOpen(false);
      /* This device stops ringing for the account that is leaving it. */
      await forgetPushOnSignOut();
      await signOut();
      navigate('/');
   };

   const face = (size: string) =>
      avatar ? (
         <img
            src={avatar}
            alt=""
            className={cn('block rounded-full object-cover', size)}
         />
      ) : (
         initial
      );

   const renderRow = (row: Row) => (
      <NavLink
         key={row.to}
         to={row.to}
         end={row.end}
         onClick={() => setOpen(false)}
         className={({ isActive }) =>
            cn(
               'flex min-h-[52px] items-center gap-3 border-l-[3px] px-4 transition-colors duration-100',
               isActive
                  ? 'border-teal bg-teal/10 text-ink'
                  : 'border-transparent hover:bg-bg-2',
               row.only
            )
         }
      >
         <span className="g-tracked flex-1 truncate text-[19px]">
            {row.label}
         </span>
      </NavLink>
   );

   return (
      <>
         <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Your account"
            onClick={() => setOpen(true)}
            className="grid size-11 place-items-center overflow-hidden rounded-full border border-paper-2 text-[15px] text-paper"
         >
            {face('size-11')}
         </button>

         <Sheet
            open={open}
            onOpenChange={setOpen}
            side="right"
            title="Your account"
         >
            {/* The black plate, edge to edge, so the panel reads as one of the
                app's blocks. The insets are padding on the plate, which keeps
                the ground full bleed and moves only what is written on it. */}
            <div className="blk blk-plain flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]">
               <div className="flex items-center gap-3 border-b border-line px-4 py-4">
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-paper-2 text-[15px] text-paper">
                     {face('size-11')}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                     <span className="g-tracked truncate text-[21px] text-ink">
                        {user.name || user.email}
                     </span>
                     <span className="truncate text-[13px] text-ink-3">
                        {handle}
                     </span>
                  </span>
                  <button
                     type="button"
                     onClick={() => setOpen(false)}
                     aria-label="Close"
                     className="grid size-11 shrink-0 place-items-center rounded-full border border-line-2 text-ink transition-colors hover:border-ink"
                  >
                     <XMarkIcon
                        aria-hidden="true"
                        className="size-5"
                        strokeWidth={1.5}
                     />
                  </button>
               </div>

               <nav
                  aria-label="Your account"
                  className="thread-scroll min-h-0 flex-1 overflow-y-auto py-1"
               >
                  {groups.map((group) => (
                     <div key={group.title} className="pb-2">
                        <span className="lab block px-4 pt-3 pb-1 text-ink-3">
                           {group.title}
                        </span>
                        {group.rows.map(renderRow)}
                     </div>
                  ))}
                  <div className="border-t border-line pt-1">
                     {(isAdminSession(user)
                        ? [accountRow, adminRow]
                        : [accountRow]
                     ).map(renderRow)}
                  </div>
               </nav>

               {/* Sign out sits away from the list, so a thumb running down the
                   rows cannot land on it. The sun and moon comes off a 390
                   header that was carrying four things and keeps its place on
                   a desktop, where there is room for it. */}
               <div className="flex items-center gap-3 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                     type="button"
                     onClick={leave}
                     className="g-tracked inline-flex min-h-11 flex-1 items-center border border-line-2 px-3 text-[17px] text-ink transition-colors hover:border-ink"
                  >
                     Sign out
                  </button>
                  <ThemeToggle className="shrink-0 md:hidden" />
               </div>

               {/* The signed-in app has no footer, so the small print lives
                   here, where an account's other housekeeping already is. */}
               <p className="flex gap-4 px-4 pb-3 text-[13px] text-ink-3">
                  <NavLink
                     to="/privacy"
                     onClick={() => setOpen(false)}
                     className="inline-flex min-h-11 items-center hover:text-ink"
                  >
                     Privacy
                  </NavLink>
                  <NavLink
                     to="/terms"
                     onClick={() => setOpen(false)}
                     className="inline-flex min-h-11 items-center hover:text-ink"
                  >
                     Terms
                  </NavLink>
               </p>
            </div>
         </Sheet>
      </>
   );
}
