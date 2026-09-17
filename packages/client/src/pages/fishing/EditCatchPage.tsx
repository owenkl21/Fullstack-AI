import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/title';
import {
   snapshotFromStoredConditions,
   type StoredConditions,
} from '@/lib/weather';
import {
   CatchForm,
   type CatchFormInitial,
   type GearOption,
} from '@/pages/fishing/LogCatchPage';

type LoadedCatch = StoredConditions & {
   /* The catch's own pin and its privacy, so an edit opens on both. */
   latitude?: number | null;
   longitude?: number | null;
   visibility?: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   hideLocation?: boolean;
   id: string;
   title: string;
   notes: string | null;
   caughtAt: string;
   site: { id: string } | null;
   gears: GearOption[];
   images: { image: { id: string; url: string; storageKey: string } }[];
   length: number | null;
   weight: number | null;
   count: number | null;
   depth: number | null;
   waterTemp: number | null;
};

type LoadState = 'loading' | 'ready' | 'missing' | 'failed';

function EditSkeleton() {
   return (
      <div
         role="status"
         aria-label="Reading the catch"
         className="flex flex-col gap-8"
      >
         <div className="h-10 w-2/5 bg-bg-2" />
         <div className="aspect-[4/3] w-full max-w-[280px] bg-bg-2" />
         <div className="flex flex-col gap-4">
            <div className="h-5 w-1/3 bg-bg-2" />
            <div className="h-5 w-4/5 bg-bg-2" />
            <div className="h-5 w-3/5 bg-bg-2" />
         </div>
         <span className="sr-only">Reading the catch</span>
      </div>
   );
}

export function EditCatchPage() {
   const { catchId } = useParams();
   const [record, setRecord] = useState<LoadedCatch | null>(null);
   const [state, setState] = useState<LoadState>(
      catchId ? 'loading' : 'missing'
   );
   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      if (!catchId) {
         return;
      }

      let cancelled = false;

      axios
         .get(`/api/catches/${catchId}`)
         .then((response) => {
            if (cancelled) return;
            if (!response.data?.catch) {
               setState('missing');
               return;
            }
            setRecord(response.data.catch);
            setState('ready');
         })
         .catch((error: unknown) => {
            if (cancelled) return;
            if (axios.isAxiosError(error) && error.response?.status === 404) {
               setState('missing');
               return;
            }
            console.error('Unable to read the catch', error);
            setState('failed');
         });

      return () => {
         cancelled = true;
      };
   }, [catchId, attempt]);

   const retry = () => {
      setState('loading');
      setAttempt((count) => count + 1);
   };

   /* A skeleton that never resolves becomes a sentence with a way forward. */
   useEffect(() => {
      if (state !== 'loading') {
         return;
      }
      const timer = window.setTimeout(() => {
         setState((current) => (current === 'loading' ? 'failed' : current));
      }, 5000);
      return () => window.clearTimeout(timer);
   }, [state]);

   useDocumentTitle(record ? `Edit ${record.title}` : 'Edit a catch');

   const initial = useMemo<CatchFormInitial | null>(() => {
      if (!record) {
         return null;
      }

      return {
         title: record.title,
         notes: record.notes,
         caughtAt: record.caughtAt,
         siteId: record.site?.id ?? null,
         latitude: record.latitude ?? null,
         longitude: record.longitude ?? null,
         visibility: record.visibility,
         hideLocation: record.hideLocation ?? false,
         length: record.length,
         weight: record.weight,
         count: record.count,
         depth: record.depth,
         waterTemp: record.waterTemp,
         gearIds: (record.gears ?? []).map((entry) => entry.id),
         gears: record.gears ?? [],
         images: (record.images ?? []).map((entry) => ({
            storageKey: entry.image.storageKey,
            url: entry.image.url,
         })),
         snapshot: snapshotFromStoredConditions(record),
         weather: record.weather ?? null,
      };
   }, [record]);

   return (
      <RequireSignIn what="this catch">
         <section className="mx-auto w-[min(1400px,100%-32px)] py-8 md:py-12">
            <h1 className="g text-[44px] md:text-[56px]">
               {record ? record.title : 'Edit a catch'}
            </h1>

            {state === 'loading' ? (
               <div className="mt-10">
                  <EditSkeleton />
               </div>
            ) : null}

            {state === 'missing' ? (
               <div className="mt-6 flex flex-col items-start gap-6">
                  <p className="max-w-[52ch] text-ink-2">
                     That catch is not here. It may have been deleted.
                  </p>
                  <Button asChild>
                     <Link to="/catches/me">Back to catches</Link>
                  </Button>
               </div>
            ) : null}

            {state === 'failed' ? (
               <div className="mt-6 flex flex-col items-start gap-6">
                  <p className="max-w-[52ch] text-destructive">
                     Could not read this catch.
                  </p>
                  <Button variant="outline" onClick={retry}>
                     Try again
                  </Button>
               </div>
            ) : null}

            {state === 'ready' && initial && catchId ? (
               <>
                  <p className="mt-3 max-w-[52ch] text-ink-2">
                     Everything you logged is here. Change what is wrong and
                     leave the rest.
                  </p>
                  <div className="mt-10">
                     <CatchForm
                        mode="edit"
                        catchId={catchId}
                        initial={initial}
                     />
                  </div>
               </>
            ) : null}
         </section>
      </RequireSignIn>
   );
}
