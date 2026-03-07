import { useEffect, useState } from 'react';
import type { ToastMessage } from '@/components/ui/toast';

const TOAST_TTL_MS = 4500;

type ToastInput = Omit<ToastMessage, 'id'>;
type Listener = (toasts: ToastMessage[]) => void;

let memoryState: ToastMessage[] = [];
const listeners = new Set<Listener>();

const notify = () => {
   listeners.forEach((listener) => listener(memoryState));
};

export const toast = ({ title, description, variant }: ToastInput) => {
   const id = crypto.randomUUID();
   memoryState = [...memoryState, { id, title, description, variant }];
   notify();

   window.setTimeout(() => {
      memoryState = memoryState.filter((item) => item.id !== id);
      notify();
   }, TOAST_TTL_MS);
};

export const dismissToast = (id: string) => {
   memoryState = memoryState.filter((item) => item.id !== id);
   notify();
};

export function useToast() {
   const [toasts, setToasts] = useState<ToastMessage[]>(memoryState);

   useEffect(() => {
      listeners.add(setToasts);

      return () => {
         listeners.delete(setToasts);
      };
   }, []);

   return { toasts, toast, dismissToast };
}
