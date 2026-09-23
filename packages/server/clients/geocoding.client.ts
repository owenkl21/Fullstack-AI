/*
 * Names and places.
 *
 * Two directions. A name typed into the forecast search becomes coordinates,
 * through Open-Meteo's geocoder, which is keyless and covers every town and
 * headland in the Cape. Coordinates from a phone become a name, through
 * Nominatim, so the conditions panel can say "at Kommetjie" rather than
 * printing a pair of numbers nobody can read.
 *
 * Both are asked from here rather than the browser: Nominatim requires a real
 * User-Agent, and a page cannot set one.
 */

import axios from 'axios';

const USER_AGENT =
   'fisherfeed/1.0 (South African shore fishing log; github.com/owenkl21/fishlogger)';

export interface Coordinates {
   latitude: number;
   longitude: number;
   name: string;
   country: string;
}

export type PlaceHit = {
   id: string;
   name: string;
   /* Province or state, then country. What tells two Kommetjies apart. */
   region: string | null;
   country: string | null;
   latitude: number;
   longitude: number;
   /* What kind of place: a town, a farm, a winery, a dam. */
   kind: string | null;
};

type GeocodeRow = {
   id: number;
   name: string;
   latitude: number;
   longitude: number;
   country?: string;
   admin1?: string;
};

export async function getCoordinates(
   locationName: string
): Promise<Coordinates> {
   const [place] = await searchPlaces(locationName, 1);
   if (!place) {
      throw new Error(`No coordinates found for location: ${locationName}`);
   }
   return {
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      country: place.country ?? '',
   };
}

/** Up to `count` places matching a typed name, best first. */
type PhotonFeature = {
   geometry?: { coordinates?: [number, number] };
   properties?: {
      osm_id?: number | string;
      osm_key?: string;
      osm_value?: string;
      name?: string;
      city?: string;
      town?: string;
      village?: string;
      county?: string;
      state?: string;
      country?: string;
      countrycode?: string;
   };
};

/*
 * The country this is a log for, as a box and as a code.
 *
 * Every geocoder on earth will answer "Kanu" with a city in Japan and a
 * district in Uganda, because those are the biggest things by that name in the
 * world. They are never the answer here: this is a South African shore fishing
 * log, and the thing being looked for is a dam, a lodge, a farm gate or a
 * gully on this coast. So both providers are asked about this country first,
 * and the world is only asked when this country knows nothing by that name.
 */
const ZA = { west: 16.2, south: -35.0, east: 33.1, north: -22.0 };
const ZA_CENTRE = { latitude: -30.56, longitude: 22.94 };

/* The kind of place in a word an angler would use. */
const kindOf = (key?: string, value?: string): string | null => {
   if (!value) return null;
   const v = value.replace(/_/g, ' ');
   if (key === 'craft' && v === 'winery') return 'wine farm';
   if (key === 'landuse' && v === 'vineyard') return 'wine farm';
   if (key === 'landuse' && v === 'farmland') return 'farm';
   if (key === 'landuse' && v === 'reservoir') return 'dam';
   if (key === 'water' && v === 'reservoir') return 'dam';
   if (key === 'tourism' && v === 'caravan site') return 'caravan park';
   if (key === 'leisure' && v === 'slipway') return 'slipway';
   return v;
};

/*
 * What an angler is actually asking for, scored.
 *
 * A search is a list of things called roughly the same name, and the only
 * question worth answering is which of them somebody could go and fish. A dam,
 * a river mouth, a lodge and a caravan park are places you drive to. A
 * residential block, a street and an industrial site carry the same names and
 * are never the answer, which is why "Rooi-Els" used to come back as a row of
 * suburban streets in KwaZulu-Natal while the village on the coast, the one
 * everybody means, was nowhere on the list.
 */
const WANTED: Record<string, number> = {
   dam: 60,
   reservoir: 60,
   bay: 55,
   beach: 55,
   lagoon: 55,
   estuary: 55,
   'river mouth': 55,
   strait: 40,
   cape: 50,
   peninsula: 45,
   headland: 50,
   island: 45,
   reef: 50,
   river: 45,
   stream: 25,
   water: 45,
   harbour: 55,
   marina: 50,
   slipway: 55,
   pier: 45,
   village: 50,
   town: 50,
   hamlet: 40,
   city: 40,
   suburb: 25,
   locality: 30,
   farm: 45,
   'wine farm': 40,
   resort: 45,
   hotel: 35,
   'guest house': 35,
   chalet: 35,
   camp_site: 40,
   'camp site': 40,
   'caravan park': 40,
   'nature reserve': 45,
   'national park': 45,
   'fishing spot': 60,
   attraction: 20,
   viewpoint: 20,
};

const UNWANTED: Record<string, number> = {
   residential: -70,
   street: -60,
   house: -70,
   building: -60,
   apartments: -70,
   neighbourhood: -30,
   industrial: -70,
   commercial: -50,
   retail: -50,
   construction: -70,
   quarter: -30,
   administrative: -35,
   boundary: -45,
   political: -45,
   postcode: -60,
   restaurant: -25,
   cafe: -25,
   'fast food': -40,
   shop: -30,
   convenience: -30,
   supermarket: -40,
   government: -45,
   school: -45,
   hospital: -45,
   church: -40,
   bank: -45,
   pharmacy: -45,
   'bus stop': -55,
   station: -35,
};

/* Diacritics off, punctuation to spaces: "Rooi-Els" and "rooi els" are one. */
const plain = (value: string) =>
   value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

const inZa = (hit: PlaceHit) =>
   hit.latitude >= ZA.south &&
   hit.latitude <= ZA.north &&
   hit.longitude >= ZA.west &&
   hit.longitude <= ZA.east;

/* Rough kilometres. Good enough to order a list, and no trigonometry table. */
const kmApart = (
   a: { latitude: number; longitude: number },
   b: { latitude: number; longitude: number }
) =>
   Math.hypot(
      (a.latitude - b.latitude) * 111,
      (a.longitude - b.longitude) *
         111 *
         Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180)
   );

/*
 * The spellings of one typed name.
 *
 * "Rooi-Els" is how everybody writes the village and "Rooiels" is how
 * OpenStreetMap holds it, and with only the first spelling both geocoders
 * answer with a row of suburban streets in Richards Bay and never mention the
 * place on the coast at all. So the joined spelling is asked for as well, and
 * a name is scored against whichever spelling it answers best.
 */
const spellingsOf = (query: string): string[] => {
   const q = plain(query);
   const joined = q.replace(/ /g, '');
   return joined && joined !== q ? [q, joined] : [q];
};

const nameScore = (name: string, spellings: string[]): number => {
   let best = 0;
   for (const q of spellings) {
      if (!q) continue;
      const value = name.includes(' ')
         ? /* Same spelling with the spaces taken out counts as the same name. */
           name === q || name.replace(/ /g, '') === q
            ? 100
            : name.startsWith(q)
              ? 70
              : name.includes(q)
                ? 40
                : q.split(' ').every((word) => name.includes(word))
                  ? 25
                  : 0
         : name === q
           ? 100
           : name.startsWith(q)
             ? 70
             : name.includes(q)
               ? 40
               : q.split(' ').every((word) => name.includes(word))
                 ? 25
                 : 0;
      if (value > best) best = value;
   }
   return best;
};

function score(
   hit: PlaceHit,
   spellings: string[],
   near?: { latitude: number; longitude: number } | null
): number {
   const name = plain(hit.name);
   let value = nameScore(name, spellings);

   /* A name with words nobody typed is a different place with a similar name:
    * "Theewaterskloof Municipality - Villiersdorp" is not the dam. */
   const typed = Math.max(...spellings.map((q) => q.split(' ').length));
   value -= Math.max(0, name.split(' ').length - typed) * 6;

   /* What kind of thing it is. */
   const kind = hit.kind ? hit.kind.toLowerCase() : '';
   value += WANTED[kind] ?? 0;
   value += UNWANTED[kind] ?? 0;

   /* Where it is. This country, then how far from the reader or the middle. */
   if (inZa(hit)) value += 120;
   const from = near ?? ZA_CENTRE;
   const km = kmApart(hit, from);
   /* Full marks inside an hour's drive, nothing at all past the country. */
   value += Math.max(0, 60 - km / 15);

   return value;
}

/*
 * Photon (komoot's geocoder over OpenStreetMap) is the one that forgives a
 * typo and answers a half typed name, which is what a search field needs. It
 * is asked inside this country's box, so the fuzzy matching spends itself on
 * places here rather than on the largest thing in the world by that name.
 */
async function searchPhoton(
   query: string,
   count: number,
   near?: { latitude: number; longitude: number } | null,
   bounded = true
): Promise<PlaceHit[]> {
   const params: Record<string, string | number> = {
      q: query,
      limit: count,
      lang: 'en',
   };
   if (bounded) params.bbox = `${ZA.west},${ZA.south},${ZA.east},${ZA.north}`;
   if (near) {
      params.lat = near.latitude;
      params.lon = near.longitude;
   }
   const { data } = await axios.get<{ features?: PhotonFeature[] }>(
      'https://photon.komoot.io/api/',
      { params, headers: { 'User-Agent': USER_AGENT }, timeout: 8000 }
   );
   const hits: PlaceHit[] = [];
   for (const f of data.features ?? []) {
      const props = f.properties ?? {};
      const coords = f.geometry?.coordinates;
      if (!props.name || !coords) continue;
      const [longitude, latitude] = coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const locality = props.city ?? props.town ?? props.village ?? null;
      const region = [locality, props.state ?? props.county ?? null]
         .filter((part) => part && part !== props.name)
         .join(', ');
      hits.push({
         id: `photon:${props.osm_id ?? `${latitude},${longitude}`}`,
         name: props.name,
         region: region || null,
         country: props.country ?? null,
         latitude,
         longitude,
         kind: kindOf(props.osm_key, props.osm_value),
      });
   }
   return hits;
}

type NominatimHit = {
   place_id?: number;
   osm_id?: number;
   lat?: string;
   lon?: string;
   name?: string;
   display_name?: string;
   category?: string;
   type?: string;
   address?: Record<string, string>;
};

/*
 * Nominatim is the one that knows the small things by their real names: the
 * lodge, the farm, the caravan park, the dam wall. It is slower and stricter
 * than Photon and it asks for no more than one request a second from anybody,
 * so it is held to that below and everything it answers is remembered for a
 * few minutes.
 */
async function searchNominatim(
   query: string,
   count: number
): Promise<PlaceHit[]> {
   const { data } = await axios.get<NominatimHit[]>(
      'https://nominatim.openstreetmap.org/search',
      {
         params: {
            q: query,
            format: 'jsonv2',
            countrycodes: 'za',
            limit: count,
            addressdetails: 1,
            dedupe: 1,
            'accept-language': 'en',
         },
         headers: { 'User-Agent': USER_AGENT },
         timeout: 8000,
      }
   );

   const hits: PlaceHit[] = [];
   for (const row of data ?? []) {
      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      /* jsonv2 gives a bare name for a named thing and nothing for a street
       * number, in which case the first part of the display name is the name. */
      const name = row.name || row.display_name?.split(',')[0]?.trim();
      if (!name) continue;
      const a = row.address ?? {};
      const locality =
         a.village ?? a.town ?? a.city ?? a.suburb ?? a.municipality ?? null;
      const region = [locality, a.state ?? a.province ?? a.county ?? null]
         .filter((part) => part && part !== name)
         .join(', ');
      hits.push({
         id: `osm:${row.osm_id ?? row.place_id ?? `${latitude},${longitude}`}`,
         name,
         region: region || null,
         country: a.country ?? 'South Africa',
         latitude,
         longitude,
         kind: kindOf(row.category, row.type),
      });
   }
   return hits;
}

/*
 * Nominatim's one request a second, kept without making the field wait behind
 * a queue. A search that would have to wait more than a moment goes without
 * it: Photon has already answered, and a list that arrives is worth more than
 * a better list that arrives after the angler has given up typing.
 */
let nominatimFreeAt = 0;
const NOMINATIM_GAP_MS = 1100;

async function searchNominatimPolitely(
   query: string,
   count: number
): Promise<PlaceHit[]> {
   const now = Date.now();
   const wait = nominatimFreeAt - now;
   if (wait > 600) return [];
   nominatimFreeAt = Math.max(now, nominatimFreeAt) + NOMINATIM_GAP_MS;
   if (wait > 0) await new Promise((done) => setTimeout(done, wait));
   return searchNominatim(query, count);
}

async function searchOpenMeteo(
   query: string,
   count: number
): Promise<PlaceHit[]> {
   const { data } = await axios.get<{ results?: GeocodeRow[] }>(
      'https://geocoding-api.open-meteo.com/v1/search',
      {
         params: { name: query, count, language: 'en', format: 'json' },
         headers: { 'User-Agent': USER_AGENT },
         timeout: 8000,
      }
   );

   return (data.results ?? []).map((row) => ({
      id: `om:${row.id}`,
      name: row.name,
      region: row.admin1 ?? null,
      country: row.country ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      kind: null,
   }));
}

/* The same name from two providers is one place, at about a hundred metres. */
const merge = (lists: PlaceHit[][]): PlaceHit[] => {
   const seen = new Map<string, PlaceHit>();
   for (const list of lists) {
      for (const hit of list) {
         const key = `${plain(hit.name)}|${hit.latitude.toFixed(3)}|${hit.longitude.toFixed(3)}`;
         const had = seen.get(key);
         /* Keep whichever copy knows what kind of place it is. */
         if (!had || (!had.kind && hit.kind)) seen.set(key, hit);
      }
   }
   return [...seen.values()];
};

const settledList = (result: PromiseSettledResult<PlaceHit[]>): PlaceHit[] => {
   if (result.status === 'fulfilled') return result.value;
   console.warn('[places] a provider failed', String(result.reason));
   return [];
};

/* A few minutes of the same answer. A search field asks four times for one
 * word, and two of those are the same word with a letter added and removed. */
const SEARCH_TTL_MS = 5 * 60 * 1000;
const searches = new Map<string, { at: number; hits: PlaceHit[] }>();

export async function searchPlaces(
   query: string,
   count = 10,
   near?: { latitude: number; longitude: number } | null
): Promise<PlaceHit[]> {
   const key = `${plain(query)}|${near ? `${near.latitude.toFixed(1)},${near.longitude.toFixed(1)}` : ''}|${count}`;
   const had = searches.get(key);
   if (had && Date.now() - had.at < SEARCH_TTL_MS) return had.hits;

   const spellings = spellingsOf(query);

   /* All of them at once. None is allowed to hold up the others, and the one
    * that fails is simply not in the list. */
   const answers = await Promise.allSettled([
      ...spellings.map((spelling) => searchPhoton(spelling, 20, near)),
      searchNominatimPolitely(query, 20),
   ]);

   let hits = merge(answers.map(settledList));

   /*
    * Nothing in this country by that name. Only now is the rest of the world
    * worth asking, because somebody looking up Tofo or Vilanculos means it.
    */
   if (!hits.length) {
      const [wide, towns] = await Promise.allSettled([
         searchPhoton(query, count, near, false),
         searchOpenMeteo(query, count),
      ]);
      hits = merge([settledList(wide), settledList(towns)]);
   }

   const ranked = hits
      .map((hit) => ({ hit, value: score(hit, spellings, near) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count)
      .map((row) => row.hit);

   if (searches.size > 500) searches.clear();
   searches.set(key, { at: Date.now(), hits: ranked });
   return ranked;
}

export type PlaceName = {
   /* The nearest named place: a suburb, village or town. */
   name: string;
   region: string | null;
};

/*
 * Reverse lookups are cached for a day on the place to two decimals, about a
 * kilometre. Nominatim asks for at most one request a second from anyone, and
 * every visit to the home page would otherwise be one.
 */
const NAME_TTL_MS = 24 * 60 * 60 * 1000;
const names = new Map<string, { at: number; value: PlaceName | null }>();

type NominatimReverse = {
   name?: string;
   address?: Record<string, string>;
};

export async function namePlace(
   latitude: number,
   longitude: number
): Promise<PlaceName | null> {
   const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
   const hit = names.get(key);
   if (hit && Date.now() - hit.at < NAME_TTL_MS) {
      return hit.value;
   }

   let value: PlaceName | null = null;
   try {
      const { data } = await axios.get<NominatimReverse>(
         'https://nominatim.openstreetmap.org/reverse',
         {
            params: {
               format: 'jsonv2',
               lat: latitude,
               lon: longitude,
               /* Suburb or village, not the street: nobody fishes an address. */
               zoom: 14,
               'accept-language': 'en',
            },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 8000,
         }
      );

      const a = data.address ?? {};
      /*
       * The first named place that is a place. OpenStreetMap carries the
       * municipal wards as boundaries, and around Cape Town the nearest
       * "suburb" to a beach is often "Cape Town Ward 21", which nobody has
       * ever called anywhere. A ward is skipped in favour of the next name.
       */
      const isWard = (value: string | undefined) =>
         !value || /\bward\b\s*\d*/i.test(value);
      const name =
         [
            a.neighbourhood,
            a.suburb,
            a.village,
            a.hamlet,
            a.town,
            a.city_district,
            a.city,
            a.municipality,
            data.name,
         ].find((value) => !isWard(value)) ?? null;

      if (name) {
         value = { name, region: a.state ?? a.province ?? a.county ?? null };
      }
   } catch (error) {
      console.warn('[geocoding] reverse lookup failed', {
         key,
         error: String(error),
      });
      /* Not remembered: a failure should be tried again, not repeated. */
      return null;
   }

   if (names.size > 2000) names.clear();
   names.set(key, { at: Date.now(), value });
   return value;
}
