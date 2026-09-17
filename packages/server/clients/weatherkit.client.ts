import type { Conditions } from './open-meteo.client';
import { toCardinal } from './open-meteo.client';

/*
 * Apple's weather, the one the phone shows, for the reading of the moment.
 *
 * Off unless four variables are set: the team id, the key id, the service id
 * and the private key from the developer account. With them the current
 * reading at a position comes from WeatherKit and the rest of the day (sea,
 * moon, the week) still comes from Open-Meteo, because WeatherKit has no sea.
 *
 * The token is an ES256 JWT signed with WebCrypto, so no dependency is needed
 * for it. Cached for most of its hour.
 */

const TEAM = process.env.WEATHERKIT_TEAM_ID;
const KEY_ID = process.env.WEATHERKIT_KEY_ID;
const SERVICE = process.env.WEATHERKIT_SERVICE_ID;
const PRIVATE_KEY = process.env.WEATHERKIT_PRIVATE_KEY;

export const weatherKitAvailable = () =>
   Boolean(TEAM && KEY_ID && SERVICE && PRIVATE_KEY);

const b64url = (bytes: Uint8Array | string) => {
   const raw =
      typeof bytes === 'string'
         ? Buffer.from(bytes, 'utf8')
         : Buffer.from(bytes);
   return raw
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
};

let cachedToken: { value: string; until: number } | null = null;
let keyPromise: Promise<CryptoKey> | null = null;

const importKey = () => {
   if (!keyPromise) {
      const pem = (PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
      const body = pem
         .replace(/-----BEGIN [A-Z ]+-----/g, '')
         .replace(/-----END [A-Z ]+-----/g, '')
         .replace(/\s+/g, '');
      const der = Buffer.from(body, 'base64');
      keyPromise = crypto.subtle.importKey(
         'pkcs8',
         der,
         { name: 'ECDSA', namedCurve: 'P-256' },
         false,
         ['sign']
      );
   }
   return keyPromise;
};

async function token(): Promise<string> {
   const now = Math.floor(Date.now() / 1000);
   if (cachedToken && cachedToken.until > now + 60) return cachedToken.value;
   const header = b64url(
      JSON.stringify({ alg: 'ES256', kid: KEY_ID, id: `${TEAM}.${SERVICE}` })
   );
   const payload = b64url(
      JSON.stringify({ iss: TEAM, iat: now, exp: now + 3600, sub: SERVICE })
   );
   const data = new TextEncoder().encode(`${header}.${payload}`);
   const key = await importKey();
   const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      data
   );
   const value = `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
   cachedToken = { value, until: now + 3600 };
   return value;
}

/* WeatherKit's condition codes, in the words the rest of the product uses. */
const CONDITION: Record<string, string> = {
   Clear: 'Clear',
   MostlyClear: 'Mainly clear',
   PartlyCloudy: 'Partly cloudy',
   MostlyCloudy: 'Mostly cloudy',
   Cloudy: 'Overcast',
   Foggy: 'Fog',
   Haze: 'Haze',
   Smoky: 'Smoke',
   Breezy: 'Breezy',
   Windy: 'Windy',
   Drizzle: 'Drizzle',
   Rain: 'Rain',
   HeavyRain: 'Heavy rain',
   ScatteredShowers: 'Showers',
   Showers: 'Showers',
   IsolatedThunderstorms: 'Thunderstorms',
   ScatteredThunderstorms: 'Thunderstorms',
   Thunderstorms: 'Thunderstorms',
   StrongStorms: 'Storm',
   Hail: 'Hail',
   Frigid: 'Cold',
   Hot: 'Hot',
   Blustery: 'Windy',
   Sleet: 'Sleet',
   Snow: 'Snow',
   Flurries: 'Snow',
};

type CurrentWeather = {
   asOf?: string;
   cloudCover?: number;
   conditionCode?: string;
   daylight?: boolean;
   humidity?: number;
   precipitationIntensity?: number;
   pressure?: number;
   temperature?: number;
   temperatureApparent?: number;
   temperatureDewPoint?: number;
   uvIndex?: number;
   visibility?: number;
   windDirection?: number;
   windGust?: number;
   windSpeed?: number;
};

const num = (value: unknown) =>
   typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * The reading of the moment at a position, in the Conditions shape, or null
 * when WeatherKit is off or did not answer. Only the fields it has: the sea
 * and the sun stay null for the caller to fill from elsewhere.
 */
export async function getWeatherKitCurrent(
   latitude: number,
   longitude: number
): Promise<Partial<Conditions> | null> {
   if (!weatherKitAvailable()) return null;
   try {
      const url = `https://weatherkit.apple.com/api/v1/weather/en/${latitude.toFixed(4)}/${longitude.toFixed(4)}?dataSets=currentWeather`;
      const res = await fetch(url, {
         headers: { Authorization: `Bearer ${await token()}` },
         signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
         console.warn('[weatherkit] answered', res.status);
         return null;
      }
      const json = (await res.json()) as { currentWeather?: CurrentWeather };
      const c = json.currentWeather;
      if (!c) return null;
      const degrees = num(c.windDirection);
      const cloud = num(c.cloudCover);
      const humidity = num(c.humidity);
      return {
         observedAt: c.asOf ?? null,
         conditionText: c.conditionCode
            ? (CONDITION[c.conditionCode] ?? c.conditionCode)
            : null,
         temperatureC: num(c.temperature),
         feelsLikeC: num(c.temperatureApparent),
         dewPointC: num(c.temperatureDewPoint),
         relativeHumidity:
            humidity === null ? null : Math.round(humidity * 100),
         precipitationMm: num(c.precipitationIntensity),
         pressureMsl: num(c.pressure),
         cloudCover: cloud === null ? null : Math.round(cloud * 100),
         visibilityM: num(c.visibility),
         windSpeedKph: num(c.windSpeed),
         windGustKph: num(c.windGust),
         windDirectionDegrees: degrees,
         windDirectionCardinal: toCardinal(degrees),
         uvIndex: num(c.uvIndex),
         isDaytime: typeof c.daylight === 'boolean' ? c.daylight : null,
      };
   } catch (error) {
      console.warn('[weatherkit] failed', String(error));
      return null;
   }
}
