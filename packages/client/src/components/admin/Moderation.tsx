import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
   REASON_WORDS,
   type ReportReason,
} from '@/components/feed/moderation-api';
import { cn } from '@/lib/utils';

/*
 * The team's side of keeping the feed decent: what people have reported, and
 * the words the app masks or refuses.
 *
 * Reports come one row per thing reported, the most reported first, because
 * three people saying the same thing is the loudest signal there is. A row
 * the count has already hidden says so, and the two answers are the only two
 * there are: take it down, or put it back and close the reports.
 */

type QueueItem = {
   key: string;
   kind: 'post' | 'comment';
   id: string;
   count: number;
   reasons: Partial<Record<ReportReason, number>>;
   notes: { note: string; by: string }[];
   lastReportedAt: string;
   hidden: boolean;
   gone: boolean;
   author: { id: string; displayName: string; username: string | null } | null;
   text: string | null;
   species: string | null;
   catchId: string | null;
   postId: string | null;
};

type WordLists = { mask: string[]; block: string[] };

const when = (iso: string) => {
   const at = new Date(iso);
   return `${at.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
   })}, ${at.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
};

export function Reports() {
   const [items, setItems] = useState<QueueItem[] | null>(null);
   const [hideAfter, setHideAfter] = useState(3);
   const [failed, setFailed] = useState(false);
   const [busy, setBusy] = useState<string | null>(null);
   const [said, setSaid] = useState<string | null>(null);

   const read = async () => {
      try {
         const { data } = await axios.get<{
            items: QueueItem[];
            hideAfter: number;
         }>('/api/admin/moderation/reports');
         setItems(data.items);
         setHideAfter(data.hideAfter);
         setFailed(false);
      } catch {
         setFailed(true);
      }
   };

   useEffect(() => {
      void read();
   }, []);

   const decide = async (item: QueueItem, action: 'remove' | 'keep') => {
      setBusy(item.key);
      setSaid(null);
      try {
         await axios.post('/api/admin/moderation/reports/resolve', {
            key: item.key,
            action,
         });
         setItems((was) => (was ?? []).filter((row) => row.key !== item.key));
         setSaid(
            action === 'remove'
               ? `${item.kind === 'post' ? 'Post' : 'Comment'} taken down.`
               : `${item.kind === 'post' ? 'Post' : 'Comment'} kept. Reports closed.`
         );
      } catch {
         setSaid('That did not go through. Try again.');
      } finally {
         setBusy(null);
      }
   };

   return (
      <section className="mt-14 border-t border-line pt-10">
         <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="g text-[30px] md:text-[36px]">Reports</h2>
            {items ? (
               <span className="lab num text-ink-3">
                  {items.length === 1 ? '1 open' : `${items.length} open`}
               </span>
            ) : null}
         </div>
         <p className="mt-2 max-w-[70ch] text-[14px] text-ink-3">
            Anything {hideAfter} different people report is hidden from the feed
            at once, until you decide. Taking it down removes it for good;
            keeping it puts it back.
         </p>
         {said ? (
            <p role="status" className="mt-3 text-[15px] text-ink-2">
               {said}
            </p>
         ) : null}

         <div className="mt-6">
            {failed ? (
               <p className="text-[15px] text-ink-2">
                  Could not read the reports just now.
               </p>
            ) : !items ? (
               <p className="text-[15px] text-ink-2" role="status">
                  Reading the reports.
               </p>
            ) : items.length === 0 ? (
               <p className="text-[15px] text-ink-2">
                  Nothing reported. The feed is clean.
               </p>
            ) : (
               <ul className="flex flex-col border-t border-line">
                  {items.map((item) => (
                     <li
                        key={item.key}
                        className="grid gap-3 border-b border-line py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-8"
                     >
                        <div className="flex min-w-0 flex-col gap-1.5">
                           <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="g num text-[28px] leading-none">
                                 {item.count}
                              </span>
                              <span className="lab">
                                 {item.kind === 'post' ? 'Post' : 'Comment'}
                                 {item.author
                                    ? ` by ${item.author.displayName}`
                                    : ''}
                              </span>
                              {item.hidden ? (
                                 <span className="lab border border-ink px-1.5 py-0.5">
                                    Hidden
                                 </span>
                              ) : null}
                              {item.gone ? (
                                 <span className="lab border border-line-2 px-1.5 py-0.5 text-ink-3">
                                    Already gone
                                 </span>
                              ) : null}
                           </div>
                           <p className="line-clamp-3 text-[16px] break-words">
                              {item.species ? (
                                 <span className="font-semibold">
                                    {item.species}.{' '}
                                 </span>
                              ) : null}
                              {item.text ?? (
                                 <span className="text-ink-3">
                                    No words, a photo only.
                                 </span>
                              )}
                           </p>
                           <p className="text-[14px] text-ink-2">
                              {Object.entries(item.reasons)
                                 .map(
                                    ([reason, n]) =>
                                       `${REASON_WORDS[reason as ReportReason]}${n && n > 1 ? ` ×${n}` : ''}`
                                 )
                                 .join(', ')}
                              {' · '}
                              <span className="num">
                                 {when(item.lastReportedAt)}
                              </span>
                           </p>
                           {item.notes.length ? (
                              <ul className="mt-1 flex flex-col gap-1">
                                 {item.notes.map((note, i) => (
                                    <li
                                       key={i}
                                       className="border-l-2 border-line-2 pl-3 text-[14px] text-ink-2"
                                    >
                                       {note.note}{' '}
                                       <span className="text-ink-3">
                                          {note.by}
                                       </span>
                                    </li>
                                 ))}
                              </ul>
                           ) : null}
                           {item.catchId ? (
                              <Link
                                 to={`/catches/${item.catchId}`}
                                 className="g-tracked inline-flex min-h-11 items-center self-start text-[15px] text-teal-text hover:opacity-80"
                              >
                                 See the catch
                              </Link>
                           ) : item.postId && !item.hidden && !item.gone ? (
                              <Link
                                 to={`/feed?post=${item.postId}${item.kind === 'comment' ? `&comment=${item.id}` : ''}`}
                                 className="g-tracked inline-flex min-h-11 items-center self-start text-[15px] text-teal-text hover:opacity-80"
                              >
                                 See it in the feed
                              </Link>
                           ) : null}
                        </div>
                        <div className="flex gap-2.5 md:flex-col md:items-stretch">
                           <Button
                              type="button"
                              variant="destructive"
                              disabled={busy !== null || item.gone}
                              onClick={() => void decide(item, 'remove')}
                              className="flex-1 md:flex-none"
                           >
                              Take it down
                           </Button>
                           <Button
                              type="button"
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() => void decide(item, 'keep')}
                              className="flex-1 md:flex-none"
                           >
                              {item.gone ? 'Close reports' : 'Keep it'}
                           </Button>
                        </div>
                     </li>
                  ))}
               </ul>
            )}
         </div>
      </section>
   );
}

/*
 * The words. Two lists: masked words are swearing, printed as the first
 * letter and stars; blocked words are slurs, and anything with one in it is
 * sent back to be rewritten. A word ending in * takes every ending
 * (fok* is fokken, fokkol, fokof); without it only that word counts, which
 * is what keeps "Scunthorpe" and "cocktail" out of trouble.
 */
export function WordLists() {
   const [lists, setLists] = useState<WordLists | null>(null);
   const [saved, setSaved] = useState<WordLists | null>(null);
   const [busy, setBusy] = useState(false);
   const [said, setSaid] = useState<string | null>(null);

   useEffect(() => {
      axios
         .get<WordLists>('/api/admin/moderation/words')
         .then(({ data }) => {
            setLists(data);
            setSaved(data);
         })
         .catch(() => setSaid('Could not read the word lists just now.'));
   }, []);

   const changed =
      lists && saved && JSON.stringify(lists) !== JSON.stringify(saved);

   const save = async () => {
      if (!lists) return;
      setBusy(true);
      setSaid(null);
      try {
         const { data } = await axios.put<WordLists>(
            '/api/admin/moderation/words',
            lists
         );
         setLists(data);
         setSaved(data);
         setSaid('Saved. The new lists apply from now on.');
      } catch {
         setSaid('Not saved. Try again.');
      } finally {
         setBusy(false);
      }
   };

   const reset = async () => {
      setBusy(true);
      setSaid(null);
      try {
         const { data } = await axios.delete<WordLists>(
            '/api/admin/moderation/words'
         );
         setLists(data);
         setSaved(data);
         setSaid('Back to the built-in lists.');
      } catch {
         setSaid('Not reset. Try again.');
      } finally {
         setBusy(false);
      }
   };

   return (
      <section className="mt-14 border-t border-line pt-10">
         <h2 className="g text-[30px] md:text-[36px]">Words</h2>
         <p className="mt-2 max-w-[70ch] text-[14px] text-ink-3">
            Masked words print as the first letter and stars. Blocked words are
            refused, and the angler is asked to take them out. End a word with *
            to catch every ending, so fok* covers fokken and fokof. Posts,
            comments, names, bios and competition names all go through these
            lists.
         </p>

         {lists ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
               <WordList
                  title="Masked"
                  words={lists.mask}
                  onChange={(mask) => setLists({ ...lists, mask })}
               />
               <WordList
                  title="Blocked"
                  words={lists.block}
                  onChange={(block) => setLists({ ...lists, block })}
               />
            </div>
         ) : null}

         <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
               type="button"
               disabled={!changed || busy}
               onClick={() => void save()}
            >
               {busy ? 'Saving' : 'Save the lists'}
            </Button>
            <Button
               type="button"
               variant="outline"
               disabled={busy || !lists}
               onClick={() => void reset()}
            >
               Use the built-in lists
            </Button>
            {said ? (
               <span role="status" className="text-[15px] text-ink-2">
                  {said}
               </span>
            ) : null}
         </div>
      </section>
   );
}

function WordList({
   title,
   words,
   onChange,
}: {
   title: string;
   words: string[];
   onChange: (words: string[]) => void;
}) {
   const [adding, setAdding] = useState('');
   const add = () => {
      const fresh = adding
         .split(/[\s,]+/)
         .map((w) => w.trim().toLowerCase())
         .filter((w) => w && w.length <= 40 && !words.includes(w));
      if (fresh.length) onChange([...words, ...fresh]);
      setAdding('');
   };

   return (
      <div className="flex flex-col gap-3">
         <div className="flex items-baseline justify-between gap-4">
            <span className="lab">{title}</span>
            <span className="lab num text-ink-3">{words.length}</span>
         </div>
         <form
            className="flex gap-2"
            onSubmit={(event) => {
               event.preventDefault();
               add();
            }}
         >
            <input
               value={adding}
               onChange={(event) => setAdding(event.target.value)}
               placeholder="Add a word"
               aria-label={`Add to ${title.toLowerCase()} words`}
               className="input-line h-11 min-w-0 flex-1 text-[16px]"
            />
            <Button type="submit" variant="outline" disabled={!adding.trim()}>
               Add
            </Button>
         </form>
         <ul className="flex flex-wrap gap-1.5">
            {words.map((word) => (
               <li key={word}>
                  <button
                     type="button"
                     onClick={() => onChange(words.filter((w) => w !== word))}
                     aria-label={`Take ${word} off the list`}
                     className={cn(
                        'num inline-flex min-h-11 items-center gap-1 border border-line-2 px-2.5 text-[14px] transition-colors',
                        'hover:border-ink'
                     )}
                  >
                     {word}
                     <XMarkIcon
                        aria-hidden="true"
                        className="size-3.5 text-ink-3"
                     />
                  </button>
               </li>
            ))}
         </ul>
      </div>
   );
}
