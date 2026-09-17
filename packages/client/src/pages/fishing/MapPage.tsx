import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpotsMap, type SpotPin } from '@/components/map/SpotsMap';
import { RequireSignIn } from '@/components/shell/RequireSignIn';
import { useDocumentTitle } from '@/lib/title';

/*
 * The map, as a place of its own.
 *
 * It was reachable only as a tab inside My spots, which meant the only way to
 * look at the water was to go and look at a list first, and an angler with
 * nothing saved had no reason to go there at all. That is backwards: the map is
 * where you decide where to fish, and the list is a filing cabinet.
 *
 * Everything lands here: your spots, spots other anglers have made public, your
 * private marks, and the ramps and tackle shops around wherever you are looking.
 */

type SiteRow = {
   id: string;
   name: string;
   latitude: number | null;
   longitude: number | null;
   catchCount?: number;
};

export function MapPage() {
   useDocumentTitle('Map');
   return (
      <RequireSignIn what="the map">
         <MapScreen />
      </RequireSignIn>
   );
}

function MapScreen() {
   const navigate = useNavigate();
   const [mine, setMine] = useState<SpotPin[]>([]);

   useEffect(() => {
      const controller = new AbortController();

      axios
         .get<{ sites: SiteRow[] }>('/api/sites/me', {
            signal: controller.signal,
         })
         .then(({ data }) => {
            const rows = data.sites ?? [];
            setMine(
               rows
                  .filter(
                     (row) => row.latitude != null && row.longitude != null
                  )
                  .map((row) => ({
                     id: row.id,
                     name: row.name,
                     latitude: row.latitude as number,
                     longitude: row.longitude as number,
                     catchCount: row.catchCount ?? 0,
                  }))
            );
         })
         .catch(() => setMine([]));

      return () => controller.abort();
   }, []);

   return (
      <section className="mx-auto w-[min(1200px,100%-32px)] py-8 md:py-12">
         <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="g text-[44px] md:text-[56px]">Map</h1>
            <p className="lab num text-ink-3">
               {mine.length === 1 ? '1 of yours' : `${mine.length} of yours`}
            </p>
         </div>

         <p className="mt-3 max-w-[58ch] text-[17px] text-ink-2">
            Your spots, what other anglers have made public, your own private
            marks, and the slipways and tackle shops around them.
         </p>

         <div className="mt-6">
            <SpotsMap spots={mine} onOpen={(id) => navigate(`/sites/${id}`)} />
         </div>
      </section>
   );
}
