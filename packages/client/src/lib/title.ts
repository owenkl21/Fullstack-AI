import { useEffect } from 'react';

const BRAND = 'Name';

/** Sets the tab title from the record on screen. Pass nothing for the brand alone. */
export function useDocumentTitle(title?: string) {
   useEffect(() => {
      document.title = title ? `${title} · ${BRAND}` : BRAND;
      return () => {
         document.title = BRAND;
      };
   }, [title]);
}
