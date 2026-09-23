import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
   markKept,
   removeGear,
   removeSpot,
   saveGear,
   saveSpot,
} from './saved-api';

/*
 * Keep, or stop keeping, somebody else's spot or gear.
 *
 * One button that knows whether it has been pressed. It settles its own
 * state from the answer rather than assuming, so a keep that failed reads as
 * not kept rather than as a lie.
 */
export function SaveButton({
   kind,
   id,
   saved: initial = false,
   size = 'default',
   variant = 'outline',
   onChange,
}: {
   kind: 'spot' | 'gear';
   id: string;
   saved?: boolean;
   size?: 'default' | 'sm' | 'lg';
   variant?: 'outline' | 'ghost';
   onChange?: (saved: boolean) => void;
}) {
   const [saved, setSaved] = useState(initial);
   const [busy, setBusy] = useState(false);

   useEffect(() => setSaved(initial), [initial, id]);

   const toggle = async () => {
      setBusy(true);
      try {
         if (saved) {
            await (kind === 'spot' ? removeSpot(id) : removeGear(id));
            setSaved(false);
            markKept(kind, id, false);
            onChange?.(false);
         } else {
            await (kind === 'spot' ? saveSpot(id) : saveGear(id));
            setSaved(true);
            markKept(kind, id, true);
            onChange?.(true);
         }
      } catch {
         /* Left as it was. The button still says what is true. */
      } finally {
         setBusy(false);
      }
   };

   const Mark = saved ? BookmarkSolid : BookmarkIcon;
   const word = kind === 'spot' ? 'spot' : 'gear';

   return (
      <Button
         type="button"
         variant={variant}
         size={size}
         onClick={() => void toggle()}
         disabled={busy}
         aria-pressed={saved}
      >
         <Mark aria-hidden="true" />
         {saved ? 'Kept' : `Keep this ${word}`}
      </Button>
   );
}
