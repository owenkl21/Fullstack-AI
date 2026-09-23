import { useState } from 'react';

/*
 * A long log stays one scrollable list rather than becoming Page 4 of 19. The first
 * batch is on screen, the rest is one control away, and changing a search or a
 * filter starts the count again. The reset key is held beside the count, so nothing
 * has to be synchronised after the fact.
 */
export function useShowMore(resetKey: string, step = 20) {
   const [state, setState] = useState({ key: resetKey, shown: step });
   const shown = state.key === resetKey ? state.shown : step;

   return {
      shown,
      showMore: () => setState({ key: resetKey, shown: shown + step }),
      step,
   };
}
