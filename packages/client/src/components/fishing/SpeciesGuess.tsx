import axios from 'axios';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * "Is this a galjoen, or a blacktail?"
 *
 * After a photograph goes up the fish namer on the hub is asked for its two
 * best guesses. They are offered, never applied: the angler taps one or says
 * neither and types. When the namer is not connected nothing is shown at
 * all, which is the right amount of fuss for a feature that is off.
 */
export type SpeciesCandidate = {
   id: string;
   commonName: string;
   confidence: number;
   guess: string;
};

export async function guessSpecies(
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

export function SpeciesGuess({
   imageUrl,
   current,
   onPick,
   className,
}: {
   /* The first photograph of the catch, once it has gone up. */
   imageUrl: string | null;
   /* What the angler has already named it, so a confirmed name is quiet. */
   current: string;
   onPick: (candidate: SpeciesCandidate | null) => void;
   className?: string;
}) {
   const [result, setResult] =
      useState<Awaited<ReturnType<typeof guessSpecies>>>(null);
   const [asked, setAsked] = useState<string | null>(null);
   const [dismissed, setDismissed] = useState(false);

   useEffect(() => {
      if (!imageUrl || imageUrl === asked) return;
      const controller = new AbortController();
      setAsked(imageUrl);
      setDismissed(false);
      guessSpecies(imageUrl, controller.signal)
         .then(setResult)
         .catch(() => undefined);
      return () => controller.abort();
   }, [imageUrl, asked]);

   if (!imageUrl || !result || dismissed) return null;
   const names = result.candidates.slice(0, 2);
   if (!names.length) return null;
   if (
      names.some(
         (c) => c.commonName.toLowerCase() === current.trim().toLowerCase()
      )
   ) {
      return null;
   }

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
               <span key={c.id}>
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
                  key={c.id}
                  type="button"
                  onClick={() => {
                     onPick(c);
                     setDismissed(true);
                  }}
                  className="g-tracked inline-flex h-11 items-center border border-ink px-4 text-[17px] text-ink transition-colors duration-150 hover:bg-ink hover:text-background"
               >
                  {c.commonName}
                  <span className="num ml-2 text-[13px] opacity-60">
                     {Math.round(c.confidence * 100)}%
                  </span>
               </button>
            ))}
            <button
               type="button"
               onClick={() => {
                  onPick(null);
                  setDismissed(true);
               }}
               className="g-tracked inline-flex h-11 items-center px-2 text-[17px] text-ink-2 hover:text-ink"
            >
               Neither
            </button>
         </div>
      </div>
   );
}
