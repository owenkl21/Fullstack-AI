import { Button } from '@/components/ui/button';
import { PlainState } from './PlainState';

/*
 * A load that did not arrive, said where the list would have been. One sentence
 * naming what failed and one control that tries again. Never a toast: a toast is
 * gone in four seconds and takes the only way out with it.
 */
export function InlineError({
   message,
   onRetry,
   retryLabel = 'Try again',
}: {
   message: string;
   onRetry: () => void;
   retryLabel?: string;
}) {
   return (
      <PlainState sentence={message} role="alert">
         <Button type="button" variant="outline" onClick={onRetry}>
            {retryLabel}
         </Button>
      </PlainState>
   );
}
