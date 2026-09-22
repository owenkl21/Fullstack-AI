import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   SpotsMap,
   type FoundPlace,
   type MapFocus,
   type SpotPin,
} from '@/components/map/SpotsMap';
import { PlaceSearch } from '@/components/forecast/PlaceSearch';
import type { SpotRating } from '@/components/fishing/reviews/reviews-api';
import { stopMapEvents } from '@/lib/leaflet';
import { describePlace } from '@/lib/maps';
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
 * One shape on every screen: water corner to corner, the search floating on
 * its top edge and the controls on its bottom one. The desktop used to be a
 * heading, a paragraph describing the map you were looking at, and an
 * orphaned search field, with the map itself squeezed into the bottom half.
 *
 * Everything lands here: your spots, spots other anglers have made public, your
 * private marks, the ramps and tackle shops around wherever you are looking,
 * and whatever the search has just found.
 */

type SiteRow = {
   id: string;
   name: string;
   latitude: number | null;
   longitude: number | null;
   catchCount?: number;
   waterType?: string | null;
   lastCatchAt?: string | null;
   rating?: SpotRating | null;
   species?: { id: string; name: string; count: number }[];
   visibility?: string | null;
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
   const [found, setFound] = useState<FoundPlace | null>(null);
   /* Where the map is looking, so a search is ranked against the water in
      front of the reader rather than the middle of the country. */
   const [near, setNear] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const { ask, fix, state: positionState } = usePosition({ auto: false });
   const field = useRef<HTMLInputElement | null>(null);

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
                     waterType: row.waterType ?? null,
                     lastCatchAt: row.lastCatchAt ?? null,
                     rating: row.rating ?? null,
                     species: row.species ?? [],
                     /* So a spot kept to yourself says so on its card. */
                     visibility: row.visibility ?? null,
                  }))
            );
         })
         .catch(() => setMine([]));

      return () => controller.abort();
   }, []);

   /*
    * The centre, rounded. The map reports every settle, and a fresh object on
    * every pan would send the search field off to ask the same question again.
    * Five hundredths of a degree is about five kilometres, which is finer than
    * this ranking needs.
    */
   const onMove = useCallback(
      (centre: { latitude: number; longitude: number }) => {
         setNear((was) =>
            was &&
            Math.abs(was.latitude - centre.latitude) < 0.05 &&
            Math.abs(was.longitude - centre.longitude) < 0.05
               ? was
               : centre
         );
      },
      []
   );

   const useMyPosition = () => {
      void ask().then((next) => {
         if (next)
            setFocus({
               latitude: next.latitude,
               longitude: next.longitude,
               zoom: 13,
               key: Date.now(),
            });
      });
   };

   const guard = useCallback((element: HTMLElement | null) => {
      stopMapEvents(element);
   }, []);

   return (
      /*
       * The shell ends a page 88 pixels above the foot, so a control that
       * lands there is clear of the raised Log key. This page has no such
       * control: it ends in a floating bar that already gives the key its
       * room, and the water should run to the navigation. So it takes the
       * 24 pixels back and measures itself against the bar alone. On a
       * desktop there is no bar at all and the map takes the rest of the
       * window.
       */
      <section className="relative -mb-6 h-[calc(100dvh-60px-64px-env(safe-area-inset-bottom))] w-full overflow-hidden md:mb-0 md:h-[calc(100dvh-60px)]">
         {/* The page still names itself, for a screen reader and for the
             focus that moves here on every navigation. The map is the
             heading a sighted reader gets. */}
         <h1 className="sr-only">Map</h1>

         <SpotsMap
            full
            spots={mine}
            wheelZoom
            focus={focus}
            found={found}
            onClearFound={() => setFound(null)}
            onMove={onMove}
            onFindPlace={() => field.current?.focus()}
            onSpotSaved={(spot) =>
               setMine((current) =>
                  current.some((row) => row.id === spot.id)
                     ? current
                     : [...current, spot]
               )
            }
            onOpen={(id) => navigate(`/sites/${id}`)}
         />

         <div ref={guard} className="absolute inset-x-0 top-0 z-[600] p-3">
            <PlaceSearch
               className="w-full"
               /* The bar at the foot of the map already carries Locate,
                  and one screen does not need two of it. */
               showMine={false}
               /* What was asked stays in the field: the pin on the water is
                  the answer to it, and the question should still be there. */
               keepQuery
               /* The glass is the button it looks like, and the cross takes
                  the question and the pin that answered it away together. */
               searchButton
               clearable
               onClear={() => setFound(null)}
               near={
                  near ??
                  (fix
                     ? { latitude: fix.latitude, longitude: fix.longitude }
                     : null)
               }
               locating={positionState === 'asking'}
               inputRef={field}
               onPick={(place) =>
                  setFound({
                     id: place.id,
                     name: place.name,
                     latitude: place.latitude,
                     longitude: place.longitude,
                     /* What it is and where, in the same words the list
                        under the field used. */
                     region: describePlace(place),
                     kind: null,
                  })
               }
               onUseMine={useMyPosition}
            />
         </div>
      </section>
   );
}
