import axios from 'axios';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';
import { NotFoundPage } from '@/pages/NotFoundPage';
import {
   GearForm,
   GearFormSkeleton,
   type GearType,
   type GearValues,
} from './LogGearPage';
import { useIsSignedIn } from '@/lib/auth-client';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

type GearRecord = {
   id?: string;
   name?: unknown;
   brand?: unknown;
   type?: unknown;
   imageUrl?: unknown;
};

const GEAR_VALUES: GearType[] = [
   'ROD',
   'REEL',
   'BAIT',
   'LURE',
   'LINE',
   'HOOK',
   'WEIGHTS',
   'RIG',
];

const asGearType = (value: unknown): GearType =>
   GEAR_VALUES.find((kind) => kind === value) ?? 'ROD';

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

export function EditGearPage() {
   const { gearId } = useParams();
   const { isSignedIn } = useIsSignedIn();
   const [state, setState] = useState<LoadState>('loading');
   const [values, setValues] = useState<GearValues | null>(null);
   const [attempt, setAttempt] = useState(0);
   useDocumentTitle(values ? `Edit ${values.name}` : 'Edit gear');

   /* There is no route for one piece of gear, so the locker answers for it. */
   useEffect(() => {
      if (!isSignedIn || !gearId) {
         return;
      }

      let isCancelled = false;
      /* A skeleton that never resolves is a lie: say so after five seconds. */
      const patience = window.setTimeout(() => {
         if (!isCancelled) {
            setState((current) => (current === 'loading' ? 'error' : current));
         }
      }, 5000);

      const load = async () => {
         try {
            const { data } = await axios.get('/api/gear/me');
            const found = (data.gear ?? []).find(
               (entry: GearRecord) => entry.id === gearId
            );

            if (isCancelled) {
               return;
            }

            if (!found) {
               setState('missing');
               return;
            }

            setValues({
               name: asText(found.name),
               brand: asText(found.brand),
               type: asGearType(found.type),
               imageUrl:
                  typeof found.imageUrl === 'string' ? found.imageUrl : null,
            });
            setState('ready');
         } catch (error) {
            if (isCancelled) {
               return;
            }

            console.error(error);
            setState('error');
         }
      };

      void load();

      return () => {
         isCancelled = true;
         window.clearTimeout(patience);
      };
   }, [attempt, gearId, isSignedIn]);

   const retry = () => {
      setState('loading');
      setAttempt((count) => count + 1);
   };

   if (!gearId || state === 'missing') {
      return <NotFoundPage />;
   }

   return (
      <RequireSignIn what="your gear">
         <section className="mx-auto w-[min(1400px,100%-32px)] py-10 md:py-14">
            <h1 className="g text-[44px] md:text-[56px]">
               {values?.name ? `Edit ${values.name}` : 'Edit gear'}
            </h1>
            <p className="mt-3 max-w-[52ch] text-ink-2">
               Everything you recorded is here. Change what you need and save.
            </p>
            <div className="mt-10">
               {state === 'loading' ? <GearFormSkeleton /> : null}
               {state === 'error' ? (
                  <div className="grid justify-items-start gap-4">
                     <p className="text-[15px] text-destructive">
                        Could not load this gear.
                     </p>
                     <Button variant="outline" onClick={retry}>
                        Try again
                     </Button>
                  </div>
               ) : null}
               {state === 'ready' && values ? (
                  <GearForm gearId={gearId} initial={values} />
               ) : null}
            </div>
         </section>
      </RequireSignIn>
   );
}
