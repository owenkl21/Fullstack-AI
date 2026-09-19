import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PlainState } from './PlainState';

/*
 * Nothing logged yet. One sentence that says so without apology and the one action
 * that fixes it. Never a dead end, never an illustration.
 */
export function EmptyState({
   sentence,
   actionLabel,
   to,
}: {
   sentence: string;
   actionLabel: string;
   to: string;
}) {
   return (
      <PlainState sentence={sentence}>
         <Button asChild>
            <Link to={to}>{actionLabel}</Link>
         </Button>
      </PlainState>
   );
}
