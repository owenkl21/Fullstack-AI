import { useEffect } from 'react';

/*
 * Descriptive rather than a placeholder, until the product is named. "Name" in
 * a browser tab reads as a template that was never filled in; this reads as a
 * decision. One string to change when the name is settled.
 */
const BRAND = 'Fishing log';

/** Sets the tab title from the record on screen. Pass nothing for the brand alone. */
export function useDocumentTitle(title?: string) {
   useEffect(() => {
      document.title = title ? `${title} · ${BRAND}` : BRAND;
      return () => {
         document.title = BRAND;
      };
   }, [title]);
}
