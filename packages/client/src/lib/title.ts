import { useEffect } from 'react';

/* The product's name, settled on 18 September 2026. One string, used everywhere. */
const BRAND = 'Fishtagram';

/** Sets the tab title from the record on screen. Pass nothing for the brand alone. */
export function useDocumentTitle(title?: string) {
   useEffect(() => {
      document.title = title ? `${title} · ${BRAND}` : BRAND;
      return () => {
         document.title = BRAND;
      };
   }, [title]);
}
