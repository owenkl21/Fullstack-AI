import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/react';
import { useTheme } from '@/lib/theme';

/* Clerk's modals follow the theme: the same tokens, square corners, the two families. */
export function ThemedClerk({
   publishableKey,
   children,
}: {
   publishableKey: string;
   children: ReactNode;
}) {
   const night = useTheme() === 'night';
   return (
      <ClerkProvider
         publishableKey={publishableKey}
         appearance={{
            variables: {
               colorPrimary: '#34adbd',
               colorBackground: night ? '#151212' : '#ffffff',
               colorForeground: night ? '#f4f1ec' : '#0b0909',
               colorMutedForeground: night ? '#b9b3ac' : '#4e4a46',
               colorInput: night ? '#0b0909' : '#ffffff',
               colorInputForeground: night ? '#f4f1ec' : '#0b0909',
               colorBorder: night
                  ? 'rgba(244,241,236,0.2)'
                  : 'rgba(11,9,9,0.2)',
               colorDanger: night ? '#f0716a' : '#b3261e',
               borderRadius: '0px',
               fontFamily:
                  "'Jost', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif",
               fontFamilyButtons:
                  "'League Gothic', 'Arial Narrow', Impact, sans-serif",
            },
            elements: {
               formButtonPrimary: {
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '18px',
                  color: '#062a2f',
               },
               card: { boxShadow: 'none' },
            },
         }}
      >
         {children}
      </ClerkProvider>
   );
}
