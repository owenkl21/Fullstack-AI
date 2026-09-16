import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { Toaster } from '@/components/ui/toaster';

/*
 * No provider and no key. Auth is a cookie against our own API, so there is
 * nothing to configure here and nothing to throw on.
 *
 * This used to throw when VITE_CLERK_PUBLISHABLE_KEY was missing, above the
 * first render, which meant a missing variable produced a successful build and
 * a blank white page. The client now reads no environment variables at all.
 */
createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <BrowserRouter>
         <App />
         <Toaster />
      </BrowserRouter>
   </StrictMode>
);
