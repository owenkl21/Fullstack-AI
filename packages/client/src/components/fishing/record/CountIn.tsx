import { useCountIn } from './motion';

/*
 * A numeral that counts into place. Used for the headline measurement, the rail
 * cells and the home readouts. Prints nothing when there is no number, so the
 * caller can say what is missing in words.
 */
export function CountIn({
   value,
   decimals = 0,
   run = true,
   durationMs = 1100,
}: {
   value: number | null;
   decimals?: number;
   run?: boolean;
   durationMs?: number;
}) {
   const shown = useCountIn(value, decimals, run, durationMs);
   return <span className="num">{shown}</span>;
}
