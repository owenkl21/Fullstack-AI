/// <reference types="vite/client" />

declare global {
   interface Window {
      google?: {
         maps: {
            importLibrary: (name: 'maps') => Promise<unknown>;
            Marker: new (opts: unknown) => unknown;
         };
      };
   }
}

export {};
