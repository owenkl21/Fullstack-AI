import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   SpotsMap,
   type MapFocus,
   type SpotPin,
} from '@/components/map/SpotsMap';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import { usePhone } from '@/lib/media';
import { usePosition } from '@/lib/position';
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
   const [focus, setFocus] = useState<MapFocus | null>(null);
   const { ask, state: positionState } = usePosition({ auto: false });
   const phone = usePhone();

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

   const goTo = (latitude: number, longitude: number, zoom: number) =>
      setFocus({ latitude, longitude, zoom, key: Date.now() });

   const useMyPosition = () => {
      void ask().then((fix) => {
         if (fix) goTo(fix.latitude, fix.longitude, 13);
      });
   };

   /*
    * On a phone the map is the screen.
    *
    * It used to be a 284 pixel window on the water under a heading, a
    * paragraph and a search field, which is a picture of a map: too small to
    * see where the next headland is, so too small to decide anything with.
    * Here it runs from under the header to the top of the navigation bar, the
    * search floats on its top edge and the controls on its bottom one, and the
    * whole screen is the thing you came to look at.
    */
   if (phone) {
      return (
         /*
          * The shell ends a page 88 pixels above the foot, so a control that
          * lands there is clear of the raised Log key. This page has no such
          * control: it ends in a floating bar that already gives the key its
          * room, and the water should run to the navigation. So it takes the
          * 24 pixels back and measures itself against the bar alone.
          */
         <section className="relative -mb-6 h-[calc(100dvh-60px-64px-env(safe-area-inset-bottom))] w-full overflow-hidden">
            {/* The page still names itself, for a screen reader and for the
                focus that moves here on every navigation. The map is the
                heading a sighted reader gets. */}
            <h1 className="sr-only">Map</h1>

            <SpotsMap
               full
               spots={mine}
               wheelZoom
               focus={focus}
               onOpen={(id) => navigate(`/sites/${id}`)}
            />

            <div className="absolute inset-x-0 top-0 z-[600] p-3">
               <PlaceSearch
                  className="w-full"
                  /* The bar at the foot of the map already carries Locate,
                     and one screen does not need two of it. */
                  showMine={false}
                  locating={positionState === 'asking'}
                  onPick={(place) => goTo(place.latitude, place.longitude, 12)}
                  onUseMine={useMyPosition}
               />
            </div>
         </section>
      );
   }

   return (
      /*
       * The map page is one screen, not a page you scroll to a map on.
       *
       * It used to run the map at 62vh inside a scrolling column, so on a
       * phone the controls under the map and the locate control inside it both
       * landed in the band the fixed bar owns at the foot of the screen, and
       * were cut in half by it. The column is now told to be exactly the room
       * between the header and that bar, the map takes whatever the heading and
       * the search leave, and the controls sit inside the screen by
       * construction rather than by luck. It is a minimum rather than a fixed
       * height, so a short phone still scrolls instead of crushing the map.
       */
      <section className="mx-auto flex min-h-[calc(100dvh-60px-64px-env(safe-area-inset-bottom))] w-[min(1680px,100%-32px)] flex-col gap-5 py-6 md:min-h-[calc(100dvh-60px-96px)] md:gap-8 md:py-12">
         <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div>
               <h1 className="g text-[44px] md:text-[56px]">Map</h1>
               <p className="mt-3 max-w-[58ch] text-[17px] text-ink-2">
                  Your spots, what other anglers have made public, your own
                  private marks, and the slipways and tackle shops around them.
                  {mine.length
                     ? ` ${mine.length === 1 ? 'One' : mine.length} of the spots ${mine.length === 1 ? 'is' : 'are'} yours.`
                     : ''}
               </p>
            </div>
            {/* Somewhere else on the coast, by name, without dragging there. */}
            <PlaceSearch
               className="w-full md:w-auto"
               showMine={false}
               locating={positionState === 'asking'}
               onPick={(place) =>
                  setFocus({
                     latitude: place.latitude,
                     longitude: place.longitude,
                     zoom: 12,
                     key: Date.now(),
                  })
               }
               onUseMine={() => {
                  void ask().then((fix) => {
                     if (fix) {
                        setFocus({
                           latitude: fix.latitude,
                           longitude: fix.longitude,
                           zoom: 13,
                           key: Date.now(),
                        });
                     }
                  });
               }}
            />
         </div>

         <div className="flex min-h-[380px] flex-1 flex-col">
            <SpotsMap
               fill
               spots={mine}
               wheelZoom
               focus={focus}
               onOpen={(id) => navigate(`/sites/${id}`)}
            />
         </div>
      </section>
   );
}
