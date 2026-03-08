import { Show, SignInButton } from '@clerk/react';
import { Fish } from 'lucide-react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { ProfileSettingsPanel } from '@/components/profile/ProfileSettingsPanel';
import { Button } from '@/components/ui/button';

export function ProfilePage() {
   return (
      <div className="min-h-screen bg-background text-foreground">
         <LandingHeader />
         <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <Show when="signed-in">
               <ProfileSettingsPanel />
            </Show>
            <Show when="signed-out">
               <div className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
                  <span className="rounded-full bg-primary/10 p-3 text-primary">
                     <Fish className="size-6" />
                  </span>
                  <h1 className="text-2xl font-semibold tracking-tight">
                     Sign in to access your profile
                  </h1>
                  <p className="text-sm text-muted-foreground">
                     Your profile settings page is protected. Please sign in to
                     review and update your account details.
                  </p>
                  <SignInButton mode="modal">
                     <Button>Sign in</Button>
                  </SignInButton>
               </div>
            </Show>
         </main>
      </div>
   );
}
