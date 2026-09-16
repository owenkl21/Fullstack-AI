import axios from 'axios';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';
import { NotFoundPage } from '@/pages/NotFoundPage';
import {
   SpotForm,
   SpotFormSkeleton,
   type SpotValues,
   type WaterType,
} from './LogSitePage';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

const WATER_VALUES: WaterType[] = [
   'FRESHWATER',
   'SALTWATER',
   'BRACKISH',
   'OTHER',
];

const asWaterType = (value: unknown): WaterType | '' =>
   WATER_VALUES.find((water) => water === value) ?? '';

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

const asCoordinate = (value: unknown) =>
   typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

export function EditSitePage() {
   const { siteId } = useParams();
   const [state, setState] = useState<LoadState>('loading');
   const [values, setValues] = useState<SpotValues | null>(null);
   const [attempt, setAttempt] = useState(0);
   useDocumentTitle(values ? `Edit ${values.name}` : 'Edit a spot');

   useEffect(() => {
      if (!siteId) {
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
            const { data } = await axios.get(`/api/sites/${siteId}`);
            const site = data.site ?? {};

            if (isCancelled) {
               return;
            }

            setValues({
               name: asText(site.name),
               description: asText(site.description),
               waterType: asWaterType(site.waterType),
               accessNotes: asText(site.accessNotes),
               latitude: asCoordinate(site.latitude),
               longitude: asCoordinate(site.longitude),
            });
            setState('ready');
         } catch (error) {
            if (isCancelled) {
               return;
            }

            if (axios.isAxiosError(error) && error.response?.status === 404) {
               setState('missing');
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
   }, [attempt, siteId]);

   const retry = () => {
      setState('loading');
      setAttempt((count) => count + 1);
   };

   if (!siteId || state === 'missing') {
      return <NotFoundPage />;
   }

   return (
      <RequireSignIn what="your spots">
         <section className="mx-auto w-[min(720px,100%-32px)] py-10 md:py-14">
            <h1 className="g text-[44px] md:text-[56px]">
               {values?.name ? `Edit ${values.name}` : 'Edit a spot'}
            </h1>
            <p className="mt-3 max-w-[52ch] text-ink-2">
               Everything you recorded is here. Change what you need and save.
            </p>
            <div className="mt-10">
               {state === 'loading' ? <SpotFormSkeleton /> : null}
               {state === 'error' ? (
                  <div className="grid justify-items-start gap-4">
                     <p className="text-[15px] text-destructive">
                        Could not load this spot.
                     </p>
                     <Button variant="outline" onClick={retry}>
                        Try again
                     </Button>
                  </div>
               ) : null}
               {state === 'ready' && values ? (
                  <SpotForm siteId={siteId} initial={values} />
               ) : null}
            </div>
         </section>
      </RequireSignIn>
   );
}
