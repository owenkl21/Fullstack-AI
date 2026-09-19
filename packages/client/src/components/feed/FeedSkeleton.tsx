/*
 * A content-shaped stand-in at the real geometry of a post: the author row, the
 * photograph, two lines of text, and the sideways shape the card takes at
 * desktop, so nothing moves sideways when the real cards land. Static, because
 * nothing in this product idles.
 */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
   return (
      <div className="flex flex-col gap-6 lg:gap-8" aria-hidden="true">
         {Array.from({ length: count }).map((_, index) => (
            <article
               key={index}
               className="blk blk-flat grid grid-cols-1 lg:grid-cols-[600px_1fr] lg:grid-rows-[auto_1fr]"
            >
               <div className="flex items-center gap-3 px-4 pt-4 pr-10 pb-3.5 lg:col-start-2 lg:row-start-1 lg:px-6 lg:pt-5 lg:pr-9 lg:pb-0">
                  <span className="size-10 shrink-0 rounded-full bg-black-block-2" />
                  <span className="flex flex-col gap-2">
                     <span className="block h-4 w-32 bg-black-block-2" />
                     <span className="block h-3 w-20 bg-black-block-2" />
                  </span>
               </div>
               <div className="aspect-[4/3] w-full bg-black-block-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:min-h-full lg:w-[600px]" />
               <div className="flex flex-col gap-3 px-4 py-[18px] lg:col-start-2 lg:row-start-2 lg:px-6 lg:pt-7 lg:pb-5">
                  <span className="block h-5 w-40 bg-black-block-2" />
                  <span className="block h-3 w-full bg-black-block-2" />
                  <span className="block h-3 w-3/5 bg-black-block-2" />
               </div>
            </article>
         ))}
      </div>
   );
}
