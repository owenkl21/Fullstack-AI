/*
 * A content-shaped stand-in at the real geometry of a post: the author row, the
 * photograph, two lines of text. Static, because nothing in this product idles.
 */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
   return (
      <div className="flex flex-col gap-6" aria-hidden="true">
         {Array.from({ length: count }).map((_, index) => (
            <article key={index} className="blk">
               <div className="flex items-center gap-3 px-4 pt-5 pr-12 pb-4">
                  <span className="size-10 shrink-0 rounded-full bg-black-block-2" />
                  <span className="flex flex-col gap-2">
                     <span className="block h-4 w-32 bg-black-block-2" />
                     <span className="block h-3 w-20 bg-black-block-2" />
                  </span>
               </div>
               <div className="aspect-[4/3] w-full bg-black-block-2" />
               <div className="flex flex-col gap-3 px-4 pt-5 pb-6">
                  <span className="block h-5 w-40 bg-black-block-2" />
                  <span className="block h-3 w-full bg-black-block-2" />
                  <span className="block h-3 w-3/5 bg-black-block-2" />
               </div>
            </article>
         ))}
      </div>
   );
}
