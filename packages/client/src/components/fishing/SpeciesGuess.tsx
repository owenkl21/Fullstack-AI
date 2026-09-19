import axios from 'axios';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Species } from '@/components/fishing/quicklog/species';

/*
 * "Is this a galjoen, or a blacktail?"
 *
 * After a photograph goes up the fish namer on the hub is asked for its two
 * best guesses. They are offered, never applied: the angler taps one, or
 * types their own name below. A guess the species table does not have yet is
 * offered all the same, by its common name where the namer knows one, and
 * becomes a species the moment the angler takes it, so the catch can still
 * be scored. When the namer is not connected nothing is shown at all, which
 * is the right amount of fuss for a feature that is off.
 */
export type SpeciesCandidate = {
   /* Null until the fish has a row in the species table. */
   id: string | null;
   commonName: string;
   scientificName: string | null;
   confidence: number;
   /* The namer's own words, a scientific name. */
   guess: string;
   /* True when the name was learned from anglers' confirmed catches. */
   learned?: boolean;
};

async function guessSpecies(
   imageUrl: string,
   signal?: AbortSignal
): Promise<{
   candidates: SpeciesCandidate[];
   raw: { name: string; confidence: number }[];
} | null> {
   try {
      const { data } = await axios.post<{
         candidates: SpeciesCandidate[];
         raw: { name: string; confidence: number }[];
      }>('/api/vision/identify', { imageUrl }, { signal });
      return data;
   } catch (error) {
      /* Off, or down: either way, nothing to offer. */
      if (axios.isCancel(error)) throw error;
      return null;
   }
}

type GuessProps = {
   /* The first photograph of the catch, once it has gone up. */
   imageUrl: string | null;
   /* What the angler has already named it, so a confirmed name is quiet. */
   current: string;
   /* A name taken, with its species id; null when the angler will type. */
   onPick: (candidate: SpeciesCandidate | null) => void;
   /* A fish that just became a species, for the form's own list. */
   onCreated?: (made: Species) => void;
   className?: string;
};

export function SpeciesGuess(props: GuessProps) {
   /* A new photograph is a new question: the key throws the old answer away. */
   if (!props.imageUrl) return null;
   return <Guess key={props.imageUrl} {...props} />;
}

function Guess({
   imageUrl,
   current,
   onPick,
   onCreated,
   className,
}: GuessProps) {
   const [result, setResult] =
      useState<Awaited<ReturnType<typeof guessSpecies>>>(null);
   const [dismissed, setDismissed] = useState(false);
   const [adding, setAdding] = useState<string | null>(null);
   const [problem, setProblem] = useState<string | null>(null);

   useEffect(() => {
      if (!imageUrl) return;
      const controller = new AbortController();
      guessSpecies(imageUrl, controller.signal)
         .then(setResult)
         .catch(() => undefined);
      return () => controller.abort();
   }, [imageUrl]);

   if (!result || dismissed) return null;
   const names = result.candidates.slice(0, 2);
   if (!names.length) return null;
   if (
      names.some(
         (c) => c.commonName.toLowerCase() === current.trim().toLowerCase()
      )
   ) {
      return null;
   }

   const take = async (candidate: SpeciesCandidate) => {
      if (candidate.id) {
         onPick(candidate);
         setDismissed(true);
         return;
      }
      /* New to the table: made a species first, so the catch can carry it. */
      setAdding(candidate.guess);
      setProblem(null);
      try {
         const { data } = await axios.post<{
            species: Species;
            created: boolean;
         }>('/api/species', {
            name: candidate.commonName,
            scientificName: candidate.scientificName,
         });
         if (data.created) onCreated?.(data.species);
         onPick({
            ...candidate,
            id: data.species.id,
            commonName: data.species.commonName,
            scientificName:
               data.species.scientificName ?? candidate.scientificName,
         });
         setDismissed(true);
      } catch {
         setProblem('Could not add that species. Try again, or type the name.');
      } finally {
         setAdding(null);
      }
   };

   return (
      <div
         className={cn(
            'flex flex-col gap-2 border-l-[3px] border-teal bg-bg-2 px-4 py-3',
            className
         )}
         role="group"
         aria-label="The fish namer's guess"
      >
         <p className="text-[15px] text-ink-2">
            Is this{' '}
            {names.map((c, i) => (
               <span key={c.guess}>
                  {i > 0 ? ' or ' : ''}
                  <span className="g-tracked text-[17px] text-ink">
                     {c.commonName}
                  </span>
               </span>
            ))}
            ?
         </p>
         <div className="flex flex-wrap gap-2">
            {names.map((c) => (
               <button
                  key={c.guess}
                  type="button"
                  disabled={adding !== null}
                  onClick={() => void take(c)}
                  className="inline-flex h-11 items-center gap-2 border border-ink px-4 text-ink transition-colors duration-150 hover:bg-ink hover:text-background disabled:opacity-60"
               >
                  <span className="g-tracked text-[17px]">
                     {adding === c.guess ? 'Adding' : c.commonName}
                  </span>
                  <span className="num text-[13px] opacity-60">
                     {Math.round(c.confidence * 100)}%
                  </span>
                  {c.learned ? (
                     <span className="text-[12px] text-teal-text">learned</span>
                  ) : null}
               </button>
            ))}
            <button
               type="button"
               disabled={adding !== null}
               onClick={() => {
                  onPick(null);
                  setDismissed(true);
               }}
               className="g-tracked inline-flex h-11 items-center px-2 text-[17px] text-ink-2 hover:text-ink"
            >
               Neither, I will type it
            </button>
         </div>
         {problem ? (
            <p className="text-[15px] text-destructive">{problem}</p>
         ) : null}
      </div>
   );
}
