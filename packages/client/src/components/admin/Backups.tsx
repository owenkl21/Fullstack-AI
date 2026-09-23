import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';

/*
 * The copies of the log, and a way to take one now.
 *
 * It sits above Start fresh on purpose: the sentence the page should read as
 * is "here are your copies, and here is the thing that destroys", in that
 * order. A copy taken a minute ago is the difference between a clean start
 * and a season lost.
 */

type Backup = {
   key: string;
   name: string;
   takenAt: string | null;
   bytes: number;
};

const size = (bytes: number) =>
   bytes > 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const when = (iso: string | null) => {
   if (!iso) return 'date unknown';
   const taken = new Date(iso);
   return `${taken.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
   })}, ${taken.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
   })}`;
};

export function Backups() {
   const [files, setFiles] = useState<Backup[] | null>(null);
   const [busy, setBusy] = useState(false);
   const [said, setSaid] = useState<string | null>(null);

   const read = async () => {
      try {
         const { data } = await axios.get<{ backups: Backup[] }>(
            '/api/admin/backups'
         );
         setFiles(data.backups);
      } catch {
         setFiles([]);
      }
   };

   useEffect(() => {
      void read();
   }, []);

   const takeOne = async () => {
      setBusy(true);
      setSaid(null);
      try {
         const { data } = await axios.post<{
            name: string;
            bytes: number;
            tables: number;
            rows: number;
         }>('/api/admin/backups');
         setSaid(
            `Copy taken: ${data.tables} tables, ${data.rows} rows, ${size(data.bytes)}.`
         );
         await read();
      } catch (thrown) {
         const why =
            axios.isAxiosError(thrown) &&
            typeof thrown.response?.data?.why === 'string'
               ? thrown.response.data.why
               : null;
         setSaid(why ? `No copy was taken. ${why}` : 'No copy was taken.');
      } finally {
         setBusy(false);
      }
   };

   const fetchOne = async (key: string) => {
      try {
         const { data } = await axios.get<{ url: string }>(
            '/api/admin/backups/link',
            { params: { key } }
         );
         window.open(data.url, '_blank', 'noopener');
      } catch {
         setSaid('That copy could not be opened.');
      }
   };

   const latest = files?.[0];

   return (
      <section className="blk blk-flat mt-10 px-[22px] py-6 md:px-7">
         <span className="lab text-paper-2">Copies of the log</span>
         <h2 className="g mt-2 text-[30px] md:text-[34px]">Backups</h2>
         <p className="mt-2 max-w-[62ch] text-[16px] text-paper-2">
            One is taken every night and kept beside the photographs. Thirty are
            held, so a month of nights. Take one by hand before anything you
            cannot undo.
         </p>
         <p className="mt-1 max-w-[62ch] text-[15px] text-paper-2">
            {latest
               ? `Last copy: ${when(latest.takenAt)}, ${size(latest.bytes)}.`
               : files
                 ? 'No copy yet.'
                 : 'Reading what there is.'}
         </p>

         <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
               type="button"
               onClick={() => void takeOne()}
               disabled={busy}
            >
               {busy ? 'Taking a copy' : 'Back up now'}
            </Button>
            {said ? (
               <span role="status" className="text-[15px] text-paper-2">
                  {said}
               </span>
            ) : null}
         </div>

         {files && files.length > 0 ? (
            <ul className="mt-5 flex flex-col">
               {files.slice(0, 10).map((file) => (
                  <li
                     key={file.key}
                     className="flex items-center justify-between gap-4 border-t border-paper/15 py-2"
                  >
                     <span className="num text-[15px] text-paper">
                        {when(file.takenAt)}
                     </span>
                     <span className="num text-[14px] text-paper-2">
                        {size(file.bytes)}
                     </span>
                     <button
                        type="button"
                        onClick={() => void fetchOne(file.key)}
                        className="g-tracked inline-flex min-h-11 items-center text-[15px] text-teal-text hover:opacity-80"
                     >
                        Fetch
                     </button>
                  </li>
               ))}
            </ul>
         ) : null}

         <p className="mt-4 max-w-[62ch] text-[14px] text-paper-2">
            A copy is a gzipped SQL file. To put one back:
            <span className="num block break-words">
               gunzip -c the-file.sql.gz | mysql -h HOST -u USER -p DATABASE
            </span>
         </p>
      </section>
   );
}
