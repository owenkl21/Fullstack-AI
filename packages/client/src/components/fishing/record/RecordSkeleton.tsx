/*
 * The record at its real geometry while it loads: the photo band, then four cells
 * on their dashed rules. Static, so nothing shimmers or floats.
 */
export function RecordSkeleton() {
   return (
      <div role="status" aria-label="Loading the catch">
         <div className="h-[46dvh] min-h-[300px] w-full bg-bg-2" />
         <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-4 pt-5 md:grid-cols-4 md:gap-x-8 md:px-8">
            {[0, 1, 2, 3].map((cell) => (
               <div key={cell} className="flex flex-col gap-2 rule-dashed pt-2">
                  <div className="h-4 w-16 bg-bg-2" />
                  <div className="h-8 w-24 bg-bg-2" />
                  <div className="h-4 w-20 bg-bg-2" />
               </div>
            ))}
         </div>
         <span className="sr-only">Loading the catch</span>
      </div>
   );
}
