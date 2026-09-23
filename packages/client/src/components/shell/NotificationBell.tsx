import { useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
   resetNotifications,
   useUnreadCount,
} from '@/components/social/notifications-api';
import { CountBadge } from '@/components/ui/count-badge';
import { cn } from '@/lib/utils';

/* The bell in the header. A count on it while there is something unread. */
export function NotificationBell() {
   const unread = useUnreadCount();
   const { pathname, key } = useLocation();
   const navigate = useNavigate();

   /* The bell is only drawn for somebody signed in, so it leaving the header
    * is a sign out. Whoever signs in next starts from nothing: no count left
    * over, and nothing of theirs popping as if it had just arrived. */
   useEffect(() => resetNotifications, []);

   const label =
      unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

   /*
    * Pressing the bell while the inbox is open closes it again. Back where
    * there is somewhere to go back to, so the feed a reader came from keeps
    * its place in the scroll; the feed itself otherwise, because a bell that
    * only ever opens leaves a reader hunting for the way out.
    */
   const onInbox = pathname === '/notifications';
   const close = (event: React.MouseEvent) => {
      if (!onInbox) return;
      event.preventDefault();
      if (key === 'default') navigate('/feed');
      else navigate(-1);
   };

   return (
      <NavLink
         to="/notifications"
         onClick={close}
         aria-label={onInbox ? 'Close notifications' : label}
         title={onInbox ? 'Close notifications' : label}
         className={({ isActive }) =>
            cn(
               'relative grid size-11 place-items-center rounded-full border border-paper/25 text-paper transition-colors duration-150 [transition-timing-function:var(--ease)] hover:border-paper',
               isActive && 'border-teal text-teal'
            )
         }
      >
         <BellIcon
            aria-hidden="true"
            className="size-[22px]"
            strokeWidth={1.6}
         />
         {/* Ringed in the header's black, so it reads as sitting on the bell
             and not as part of its outline. Centred on the bell's shoulder
             rather than pinned by its right side: a pill grows both ways, so
             99+ covers less of the bell and does not run into the avatar. */}
         <CountBadge
            count={unread}
            className="absolute -top-1 left-[36px] -translate-x-1/2 ring-2 ring-black-block"
         />
      </NavLink>
   );
}
