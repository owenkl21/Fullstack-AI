import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, useSession } from '@/lib/auth-client';

/*
 * What <UserButton /> used to be, in the product's own language rather than a
 * vendor's. A round avatar that opens a short menu: the profile, the account
 * settings, and a way out.
 *
 * Round is the one exception the design rules allow to radius 0, alongside
 * avatars and round icon controls.
 */
export function AccountMenu() {
   const { data } = useSession();
   const navigate = useNavigate();
   const [open, setOpen] = useState(false);

   if (!data?.user) {
      return null;
   }

   const user = data.user;
   const initial = (user.name || user.email || '?')
      .trim()
      .charAt(0)
      .toUpperCase();

   const leave = async () => {
      setOpen(false);
      await signOut();
      navigate('/');
   };

   return (
      <div className="relative">
         <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Your account"
            onClick={() => setOpen((was) => !was)}
            className="grid size-11 place-items-center rounded-full border border-paper-2 text-[15px] text-paper"
         >
            {user.image ? (
               <img
                  src={user.image}
                  alt=""
                  className="size-full rounded-full object-cover"
               />
            ) : (
               initial
            )}
         </button>

         {open ? (
            <>
               {/* A click anywhere else closes it, which is what a menu should do. */}
               <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
               />
               <div
                  role="menu"
                  className="blk absolute right-0 z-50 mt-2 w-56 border border-line p-2"
               >
                  <p className="px-2 pt-1 pb-2 text-[14px] text-ink-2">
                     {user.email}
                  </p>
                  <Link
                     role="menuitem"
                     to="/profile"
                     onClick={() => setOpen(false)}
                     className="g-tracked block px-2 py-2 text-[17px] hover:bg-bg-2"
                  >
                     Your profile
                  </Link>
                  <Link
                     role="menuitem"
                     to="/account"
                     onClick={() => setOpen(false)}
                     className="g-tracked block px-2 py-2 text-[17px] hover:bg-bg-2"
                  >
                     Account
                  </Link>
                  <button
                     role="menuitem"
                     type="button"
                     onClick={leave}
                     className="g-tracked block w-full px-2 py-2 text-left text-[17px] hover:bg-bg-2"
                  >
                     Sign out
                  </button>
               </div>
            </>
         ) : null}
      </div>
   );
}
