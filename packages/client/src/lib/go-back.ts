import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/*
 * Back to wherever you actually came from.
 *
 * A catch opened from the feed used to send you to My catches on the way out,
 * which is not where you were and loses your place in a feed you may have
 * scrolled a long way down. The same record can be reached from the feed, a
 * list, a board or a spot, so the way out cannot be a fixed address.
 *
 * React Router marks entries it created with a key, so an entry that is not the
 * default one means we arrived by navigating inside the app and history is safe
 * to use. Arriving cold, from a shared link or a new tab, there is nothing
 * behind us, and that is what `fallback` is for.
 */
export function useGoBack(fallback: string) {
   const navigate = useNavigate();
   const location = useLocation();

   return useCallback(() => {
      if (location.key && location.key !== 'default') {
         navigate(-1);
         return;
      }
      navigate(fallback, { replace: true });
   }, [navigate, location.key, fallback]);
}
