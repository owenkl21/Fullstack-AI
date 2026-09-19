import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Species } from '@/components/fishing/quicklog/species';

/*
 * "Is this a galjoen, or a blacktail?"
 *
 * After a photograph goes up the fish namer on the hub is asked for its two
 * best guesses. The asking is shown, briefly, so the wait reads as a wait.
 * The names are offered, never applied: the angler taps one, or types their
 * own name below. A guess the species table does not have yet is
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
   const [asking, setAsking] = useState(true);
   const [dismissed, setDismissed] = useState(false);
   const [adding, setAdding] = useState<string | null>(null);
   const [problem, setProblem] = useState<string | null>(null);

   useEffect(() => {
      if (!imageUrl) return;
      const controller = new AbortController();
      guessSpecies(imageUrl, controller.signal)
         .then((found) => {
            setResult(found);
            setAsking(false);
         })
         .catch(() => undefined);
      return () => controller.abort();
   }, [imageUrl]);

   if (!imageUrl || dismissed) return null;

   /* While the namer looks: a quiet line, so the wait is seen to be a wait. */
   if (asking) {
      return (
         <div
            className={cn('flex items-center gap-3', className)}
            role="status"
            aria-live="polite"
            data-namer="asking"
         >
            <span className="shimmer h-[3px] w-10 shrink-0 bg-line" />
            <span className="text-[14px] text-ink-3">Naming the fish</span>
         </div>
      );
   }

   /* The namer is not connected: nothing to say. */
   if (!result) return null;

   const names = result.candidates.slice(0, 2);
   if (
      names.some(
         (c) => c.commonName.toLowerCase() === current.trim().toLowerCase()
      )
   ) {
      return null;
   }

   if (!names.length) {
      return (
         <p
            className={cn('text-[14px] text-ink-3', className)}
            data-namer="none"
         >
            Could not name this one. Type it.
         </p>
      );
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
         setProblem('Could not add that species. Type the name instead.');
      } finally {
         setAdding(null);
      }
   };

   /*
    * The label and the cross on one line; the names beneath as rows that
    * take the full width on a phone and two equal columns from a tablet up.
    * Nothing wraps and nothing is cut, whatever the fish is called.
    */
   return (
      <div
         className={cn('flex flex-col gap-2', className)}
         role="group"
         aria-label="The fish namer's guess"
         data-namer="named"
      >
         <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink-3">Looks like</span>
            <button
               type="button"
               disabled={adding !== null}
               onClick={() => {
                  onPick(null);
                  setDismissed(true);
               }}
               aria-label="Neither. I will type the name"
               title="Neither"
               className="-mr-2 grid size-9 place-items-center text-ink-3 hover:text-ink"
            >
               <XMarkIcon aria-hidden="true" className="size-5" />
            </button>
         </div>
         <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {names.map((c) => (
               <button
                  key={c.guess}
                  type="button"
                  disabled={adding !== null}
                  onClick={() => void take(c)}
                  className="flex h-11 items-center justify-between gap-3 border border-ink px-3 text-left text-ink transition-colors duration-150 hover:bg-ink hover:text-background disabled:opacity-60"
               >
                  <span className="g-tracked text-[17px]">
                     {adding === c.guess ? 'Adding' : c.commonName}
                  </span>
                  <span className="num shrink-0 text-[12px] opacity-60">
                     {Math.round(c.confidence * 100)}%
                  </span>
               </button>
            ))}
         </div>
         {problem ? (
            <p className="text-[14px] text-destructive">{problem}</p>
         ) : null}
      </div>
   );
}
