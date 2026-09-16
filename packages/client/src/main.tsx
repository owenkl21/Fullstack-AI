import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemedClerk } from '@/components/shell/ThemedClerk';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
   throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <ThemedClerk publishableKey={publishableKey}>
         <BrowserRouter>
            <App />
            <Toaster />
         </BrowserRouter>
      </ThemedClerk>
   </StrictMode>
);
