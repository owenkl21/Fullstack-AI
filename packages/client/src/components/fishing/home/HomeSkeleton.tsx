/*
 * The home screen at its real geometry while the log loads: the photo band, the
 * three readouts, the block and three rows. Static, and it times out into a
 * sentence with a way forward rather than sitting here.
 */
export function HomeSkeleton() {
   return (
      <div role="status" aria-label="Loading your log">
         <div className="h-[300px] w-full bg-bg-2 md:h-[380px]" />
         <div className="grid grid-cols-3 px-4 pt-6 md:px-8">
            {['Wind', 'Pressure', 'Air'].map((label, position) => (
               <div
                  key={label}
                  className={
                     position > 0
                        ? 'flex flex-col gap-2 rule-dashed-v pr-3 pl-3'
                        : 'flex flex-col gap-2 pr-3'
                  }
               >
                  <span className="lab">{label}</span>
                  <span className="h-9 w-16 bg-bg-2" />
               </div>
            ))}
         </div>
         <div className="mx-4 mt-4 h-[120px] bg-bg-2 md:mx-8" />
         <div className="mt-5">
            {[0, 1, 2].map((row) => (
               <div
                  key={row}
                  className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-4 py-2.5 md:px-8"
               >
                  <span className="size-[52px] bg-bg-2" />
                  <span className="flex flex-col gap-2">
                     <span className="h-5 w-2/5 bg-bg-2" />
                     <span className="h-4 w-4/5 bg-bg-2" />
                  </span>
                  <span className="h-6 w-14 bg-bg-2" />
               </div>
            ))}
         </div>
         <span className="sr-only">Loading your log</span>
      </div>
   );
}
