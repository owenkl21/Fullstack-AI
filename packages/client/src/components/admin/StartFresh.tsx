import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * Emptying the log, from the foot of the panel.
 *
 * The one control in the app that destroys what cannot be got back, so it is
 * built to be slow: it says what goes and what stays before it is touched, it
 * will not wake up until the words are typed, and it asks once more with the
 * figures in front of the reader. The server asks for the same phrase again,
 * so a page with a broken script cannot press it either.
 */

const PHRASE = 'start fresh';

type Preview = { removing: Record<string, number>; kept: string[] };
type Report = {
   removed: Record<string, number>;
   kept: string[];
   photos: { keys: number; deleted: number; failed: number; note?: string };
};

const count = (figures: Record<string, number>) =>
   Object.entries(figures)
      .filter(([, n]) => n > 0)
      .map(([what, n]) => `${n} ${what}`)
      .join(', ');

export function StartFresh() {
   const [preview, setPreview] = useState<Preview | null>(null);
   const [said, setSaid] = useState('');
   const [asking, setAsking] = useState(false);
   const [busy, setBusy] = useState(false);
   const [done, setDone] = useState<Report | null>(null);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      const controller = new AbortController();
      axios
         .get<Preview>('/api/admin/reset', { signal: controller.signal })
         .then(({ data }) => setPreview(data))
         .catch(() => undefined);
      return () => controller.abort();
   }, []);

   const ready = said.trim().toLowerCase() === PHRASE;

   const run = async () => {
      setBusy(true);
      setError(null);
      try {
         const { data } = await axios.post<Report>('/api/admin/reset', {
            phrase: said.trim().toLowerCase(),
         });
         setDone(data);
         setAsking(false);
         setSaid('');
      } catch (thrown) {
         /* The server's own words, so a failure can be acted on rather than
            guessed at. Nothing was removed when this shows. */
         const said =
            axios.isAxiosError(thrown) &&
            typeof thrown.response?.data?.why === 'string'
               ? thrown.response.data.why
               : null;
         setError(
            said
               ? `Nothing was emptied. The log is as it was. ${said}`
               : 'Nothing was emptied. The log is as it was.'
         );
      } finally {
         setBusy(false);
      }
   };

   if (done) {
      return (
         <section className="blk blk-flat mt-10 border border-destructive/40 px-[22px] py-6 md:px-7">
            <span className="lab text-paper-2">The log is empty</span>
            <p className="mt-2 max-w-[60ch] text-[16px] text-paper">
               Gone: {count(done.removed) || 'nothing, it was already empty'}.
            </p>
            <p className="mt-1 max-w-[60ch] text-[15px] text-paper-2">
               Kept: {done.kept.join(', ')}, and the species list.
            </p>
            <p className="mt-1 max-w-[60ch] text-[15px] text-paper-2">
               {done.photos.note
                  ? done.photos.note
                  : `Photographs: ${done.photos.deleted} taken out of storage${
                       done.photos.failed
                          ? `, ${done.photos.failed} the bucket would not take`
                          : ''
                    }.`}
            </p>
         </section>
      );
   }

   return (
      <section className="blk blk-flat mt-10 border border-destructive/40 px-[22px] py-6 md:px-7">
         <span className="lab text-destructive">Start fresh</span>
         <h2 className="g mt-2 text-[30px] md:text-[34px]">Empty the log</h2>
         <p className="mt-2 max-w-[62ch] text-[16px] text-paper-2">
            Every angler but the team, and every catch, spot, private mark,
            gear, photograph, post, comment, rating, competition and
            notification, including the team&apos;s own. The photographs go out
            of storage too. Nothing comes back.
         </p>
         <p className="mt-1 max-w-[62ch] text-[16px] text-paper-2">
            Kept: {preview?.kept.join(', ') || 'the team accounts'}, with their
            handles and pictures, and the species list so a fish can still be
            named.
         </p>
         {preview ? (
            <p className="num mt-3 text-[15px] text-paper">
               Standing right now: {count(preview.removing) || 'nothing'}.
            </p>
         ) : null}

         <label className="mt-4 flex max-w-[360px] flex-col gap-1.5">
            <span className="lab text-paper-2">
               Type {PHRASE} to wake the button
            </span>
            <input
               value={said}
               onChange={(event) => setSaid(event.target.value)}
               autoComplete="off"
               spellCheck={false}
               className="input-line h-11 text-[16px] text-paper placeholder:text-paper-2"
               placeholder={PHRASE}
            />
         </label>

         {error ? (
            <p
               role="alert"
               className="mt-3 max-w-[62ch] text-[15px] break-words text-destructive"
            >
               {error}
            </p>
         ) : null}

         {asking ? (
            <div className="mt-4 flex flex-col gap-3">
               <p className="max-w-[62ch] text-[16px] text-paper">
                  Last word. This empties{' '}
                  {count(preview?.removing ?? {}) || 'the log'} and cannot be
                  undone.
               </p>
               <div className="flex flex-wrap gap-3">
                  <Button
                     type="button"
                     disabled={busy}
                     onClick={() => void run()}
                     className={cn(
                        'bg-destructive text-paper hover:brightness-110'
                     )}
                  >
                     {busy ? 'Emptying the log' : 'Yes, empty it'}
                  </Button>
                  <Button
                     type="button"
                     variant="outline"
                     disabled={busy}
                     onClick={() => setAsking(false)}
                  >
                     Leave it
                  </Button>
               </div>
            </div>
         ) : (
            <Button
               type="button"
               disabled={!ready}
               onClick={() => setAsking(true)}
               className="mt-4 bg-destructive text-paper hover:brightness-110 disabled:opacity-40"
            >
               Empty the log
            </Button>
         )}
      </section>
   );
}
