import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ANCHOR, WRAP } from './layout';
import { photos } from './photos';
import { Link } from 'react-router-dom';

/*
 * The one full-bleed teal moment on the page, carrying the black signup box. The
 * address typed here is handed to the sign-up as its starting value.
 */
export function LandingJoin() {
   const emailId = useId();
   const [email, setEmail] = useState('');

   return (
      <section id="join" className={cn('bg-teal py-10 md:py-[72px]', ANCHOR)}>
         <div className={WRAP}>
            <div className="blk blk-plain rv">
               <div className="grid md:grid-cols-[1fr_1.2fr]">
                  <img
                     src={photos.dawnBoats}
                     alt="Anglers in a boat at dusk"
                     loading="lazy"
                     className="hidden h-full w-full object-cover md:block md:min-h-[280px]"
                  />
                  <form
                     onSubmit={(event) => event.preventDefault()}
                     className="flex flex-col gap-[22px] px-[22px] py-7 md:px-11 md:py-10"
                  >
                     <h2 className="g text-[clamp(40px,5vw,64px)]">
                        Stay on the water
                     </h2>
                     <p className="text-paper-2">
                        No setup and no tour. Log one fish and you have seen the
                        whole of it.
                     </p>
                     <div className="flex flex-col gap-1.5">
                        <label htmlFor={emailId} className="lab text-paper-2">
                           Email
                        </label>
                        <input
                           id={emailId}
                           type="email"
                           autoComplete="email"
                           placeholder="you@example.com"
                           value={email}
                           onChange={(event) => setEmail(event.target.value)}
                           className="input-line h-11 text-[16px] text-paper placeholder:text-paper-2"
                        />
                     </div>
                     <Button
                        type="submit"
                        variant="paper"
                        size="lg"
                        className="self-start"
                        asChild
                     >
                        <Link to="/sign-up">Start your log</Link>
                     </Button>
                  </form>
               </div>
            </div>
         </div>
      </section>
   );
}
