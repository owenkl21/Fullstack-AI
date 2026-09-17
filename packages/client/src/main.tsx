import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { Toaster } from '@/components/ui/toaster';
import { BootGate } from '@/components/shell/BootGate';

/*
 * No provider and no key. Auth is a cookie against our own API, so there is
 * nothing to configure here and nothing to throw on.
 *
 * This used to throw when VITE_CLERK_PUBLISHABLE_KEY was missing, above the
 * first render, which meant a missing variable produced a successful build and
 * a blank white page. The client now reads no environment variables at all.
 */
/*
 * A deploy replaces every hashed chunk. A tab that loaded index.html before
 * the deploy asks for chunks that no longer exist when it first routes, and
 * the page stops dead. Vite reports that as a preload error; one reload
 * fetches the new index and the new chunks. Guarded so a real outage does
 * not loop.
 */
window.addEventListener('vite:preloadError', (event) => {
   event.preventDefault();
   const key = 'fishlogger.reloaded-for-chunk';
   if (sessionStorage.getItem(key) === location.href) return;
   sessionStorage.setItem(key, location.href);
   location.reload();
});

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <BootGate>
         <BrowserRouter>
            <App />
            <Toaster />
         </BrowserRouter>
      </BootGate>
   </StrictMode>
);
