import { Button } from '@/components/ui/button';
import { PlainState } from './PlainState';

/*
 * The search or the filter went too narrow. A different sentence from the empty
 * state, so the two are never mistaken for each other, and one way back.
 */
export function NoMatchState({
   sentence,
   onClear,
   clearLabel = 'Clear search',
}: {
   sentence: string;
   onClear: () => void;
   clearLabel?: string;
}) {
   return (
      <PlainState sentence={sentence}>
         <Button type="button" variant="outline" onClick={onClear}>
            {clearLabel}
         </Button>
      </PlainState>
   );
}
