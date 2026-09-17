import type { ReactNode } from 'react';
import type { WeatherSnapshot } from '@/components/fishing/record/api';
import {
   DropIcon,
   MoonPhaseIcon,
   SwellIcon,
   ThermometerIcon,
   WaveIcon,
   skyIcon,
} from './ConditionIcons';

/*
 * The rest of the reading.
 *
 * Wind, pressure and air sit above this as the three figures anyone looks at
 * first. Everything else we fetch used to be thrown away on the way to the
 * screen: water temperature, swell, the moon, first and last light. A shore
 * angler plans a session on exactly those.
 *
 * A reading that is missing is left out rather than shown as a dash, so an
 * inland spot simply has no sea in it instead of a row of blanks.
 */

const clock = (iso: string | null | undefined) => {
   if (!iso) return null;
   const at = new Date(iso);
   if (Number.isNaN(at.getTime())) return null;
   /* Rendered in the reader's own zone, which is the zone they are fishing in. */
   return at.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
   });
};

const one = (n: number | null | undefined) =>
   typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null;

const whole = (n: number | null | undefined) =>
   typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;

type Fact = { key: string; icon: ReactNode; label: string; value: string };

export function ConditionsDetail({
   snapshot,
}: {
   snapshot: WeatherSnapshot | null;
}) {
   if (!snapshot) {
      return null;
   }

   const facts: Fact[] = [];
   const push = (
      key: string,
      icon: ReactNode,
      label: string,
      value: string | null
   ) => {
      if (value) facts.push({ key, icon, label, value });
   };

   const Sky = skyIcon(snapshot.weatherCondition?.description?.text);
   push(
      'sky',
      <Sky className="size-5" aria-hidden="true" />,
      'Sky',
      snapshot.weatherCondition?.description?.text || null
   );

   const water = one(snapshot.sea?.surfaceTemperatureC);
   push(
      'water',
      <ThermometerIcon aria-hidden="true" />,
      'Water',
      water === null ? null : `${water} °C`
   );

   const swell = one(snapshot.sea?.swellHeightM);
   const period = whole(snapshot.sea?.swellPeriodS);
   push(
      'swell',
      <SwellIcon aria-hidden="true" />,
      'Swell',
      swell === null
         ? null
         : period
           ? `${swell} m at ${period} s`
           : `${swell} m`
   );

   const wave = one(snapshot.sea?.waveHeightM);
   push(
      'wave',
      <WaveIcon aria-hidden="true" />,
      'Sea',
      wave === null ? null : `${wave} m`
   );

   const moon = snapshot.moon;
   push(
      'moon',
      moon ? (
         <MoonPhaseIcon fraction={moon.fraction} />
      ) : (
         <MoonPhaseIcon fraction={0} />
      ),
      moon?.spring ? 'Moon, spring tide' : 'Moon',
      moon ? `${moon.name}, ${Math.round(moon.illumination * 100)}% lit` : null
   );

   const rise = clock(snapshot.sun?.rise);
   const set = clock(snapshot.sun?.set);
   push(
      'sun',
      <Sky className="size-5" aria-hidden="true" />,
      'Light',
      rise && set ? `${rise} to ${set}` : (rise ?? set)
   );

   const humidity = whole(snapshot.relativeHumidity);
   push(
      'humidity',
      <DropIcon aria-hidden="true" />,
      'Humidity',
      humidity === null ? null : `${humidity}%`
   );

   if (!facts.length) {
      return null;
   }

   return (
      <dl className="relative mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
         {facts.map((fact) => (
            <div key={fact.key} className="flex items-start gap-2.5">
               <span className="mt-[2px] shrink-0 text-ink-3">{fact.icon}</span>
               <span className="min-w-0">
                  <dt className="lab text-ink-3">{fact.label}</dt>
                  <dd className="mt-0.5 text-[15px] text-ink">{fact.value}</dd>
               </span>
            </div>
         ))}
      </dl>
   );
}
