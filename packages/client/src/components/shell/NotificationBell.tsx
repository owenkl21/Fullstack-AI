import { BellIcon } from '@heroicons/react/24/outline';
import { NavLink } from 'react-router-dom';
import { useUnreadCount } from '@/components/social/notifications-api';
import { cn } from '@/lib/utils';

/* The bell in the header. A count on it while there is something unread. */
export function NotificationBell() {
   const unread = useUnreadCount();
   const label =
      unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
   return (
      <NavLink
         to="/notifications"
         aria-label={label}
         title={label}
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
         {unread > 0 ? (
            <span
               aria-hidden="true"
               className="num absolute -top-1 -right-1 grid min-w-[20px] place-items-center bg-teal px-1 text-[12px] leading-[20px] text-teal-ink"
            >
               {unread > 99 ? '99+' : unread}
            </span>
         ) : null}
      </NavLink>
   );
}
