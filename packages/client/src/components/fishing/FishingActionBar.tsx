import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function FishingActionBar() {
   return (
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
         <Button asChild>
            <Link to="/catches/new">Log a catch</Link>
         </Button>
         <Button asChild variant="outline">
            <Link to="/sites/new">Log fishing site</Link>
         </Button>
      </div>
   );
}
