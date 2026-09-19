import { Link } from 'react-router-dom';
import type { LogSentence } from './summary';

/*
 * One true sentence counted off the angler's own catches, on the black block with
 * the teal corner tab, and the one link in the block that matters.
 */
export function LogSays({ sentence }: { sentence: LogSentence }) {
   return (
      <div className="blk mx-4 mt-4 p-4 md:mx-8 md:p-6">
         <div className="flex flex-col gap-1.5">
            <span className="lab text-paper-2">What your log says</span>
            <p className="max-w-[54ch] text-[15px] leading-[1.45] text-paper">
               {sentence.text}
            </p>
            {sentence.link ? (
               <Link
                  to={sentence.link.to}
                  className="g-tracked inline-flex h-11 items-center self-start text-[18px] text-teal"
               >
                  {sentence.link.label}
               </Link>
            ) : null}
         </div>
      </div>
   );
}
