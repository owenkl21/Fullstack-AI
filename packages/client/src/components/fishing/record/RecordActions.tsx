import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

/*
 * What you can do with a record. A stranger gets the way back and the link; the
 * angler who logged it also gets the editor and the delete, behind one dialog that
 * names the catch and the consequence.
 */
export function RecordActions({
   catchId,
   summary,
   isOwner,
}: {
   catchId: string;
   summary: string;
   isOwner: boolean;
}) {
   const navigate = useNavigate();
   const [confirming, setConfirming] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);

   const share = async () => {
      try {
         await navigator.clipboard.writeText(window.location.href);
         toast({ title: 'Link copied. Anyone with it can read this record.' });
      } catch {
         toast({
            title: 'Could not copy the link.',
            description: 'Copy it from your browser address bar instead.',
            variant: 'error',
         });
      }
   };

   const remove = async () => {
      try {
         setIsDeleting(true);
         await axios.delete(`/api/catches/${catchId}`);
         setConfirming(false);
         // TODO(api): appendix E, no restore endpoint, so a deleted catch has no undo.
         toast({ title: `Deleted. ${summary}`, variant: 'success' });
         navigate('/catches/me', { replace: true });
      } catch {
         setIsDeleting(false);
         toast({
            title: 'Not deleted.',
            description: 'The catch is still here. Try again.',
            variant: 'error',
         });
      }
   };

   return (
      <div className="flex flex-wrap gap-2 px-4 pt-6 pb-10 md:px-8">
         <Button asChild variant="outline">
            <Link to="/catches/me">Back to catches</Link>
         </Button>
         <Button type="button" variant="ghost" onClick={() => void share()}>
            Share
         </Button>
         {isOwner ? (
            <>
               <Button asChild variant="ghost">
                  <Link to={`/catches/${catchId}/edit`}>Edit</Link>
               </Button>
               <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirming(true)}
               >
                  Delete
               </Button>
            </>
         ) : null}

         <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogContent className="sm:max-w-[480px]">
               <DialogHeader>
                  <DialogTitle className="g text-[30px] font-normal">
                     Delete this catch?
                  </DialogTitle>
                  <DialogDescription>
                     {summary} Deleting it takes the record and its photos out
                     of your log, and it cannot be undone.
                  </DialogDescription>
               </DialogHeader>
               <DialogFooter className="gap-2">
                  <Button
                     type="button"
                     variant="outline"
                     className="border-paper text-paper hover:bg-paper/10"
                     onClick={() => setConfirming(false)}
                     disabled={isDeleting}
                  >
                     Keep it
                  </Button>
                  <Button
                     type="button"
                     variant="destructive"
                     onClick={() => void remove()}
                     disabled={isDeleting}
                  >
                     {isDeleting ? 'Deleting' : 'Delete'}
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   );
}
