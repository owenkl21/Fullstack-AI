import { Component, lazy, type ComponentType, type ReactNode } from 'react';

/*
 * Loading a split route without losing the page.
 *
 * Every route in this app is code split, and the built file names carry a
 * content hash. When a deploy goes out the old hashes stop existing, so a tab
 * that was already open asks for a chunk the server no longer has. React's
 * lazy() rejects, nothing catches it, and the route renders as a blank white
 * page that only a manual refresh clears. That is the "sometimes I have to
 * refresh" fault.
 *
 * Two things fix it. The import is retried once after a moment, which covers a
 * dropped connection or a chunk still propagating. If it fails again it is
 * almost certainly a stale build, so the page reloads itself exactly once,
 * which pulls the new index.html and the new hashes. A marker in sessionStorage
 * makes sure that can never become a loop.
 */

const RELOADED = 'chunk-reload';

const isChunkFailure = (error: unknown) => {
   const message = error instanceof Error ? error.message : String(error);
   return /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(
      message
   );
};

const reloadOnce = () => {
   try {
      if (sessionStorage.getItem(RELOADED)) {
         return false;
      }
      sessionStorage.setItem(RELOADED, '1');
   } catch {
      /* Private mode, or storage refused. Reload anyway: once is still safe
       * enough, and a blank page is worse than a second load. */
   }

   window.location.reload();
   return true;
};

/* A successful navigation means whatever was wrong is behind us. */
export const clearChunkReloadMark = () => {
   try {
      sessionStorage.removeItem(RELOADED);
   } catch {
      /* Nothing to clear if storage is unavailable. */
   }
};

/** lazy(), but it retries once and then recovers a stale build. */
export function lazyRoute<T extends ComponentType<unknown>>(
   load: () => Promise<{ default: T }>
) {
   return lazy(() =>
      load().catch(async (error: unknown) => {
         if (!isChunkFailure(error)) {
            throw error;
         }

         await new Promise((resolve) => setTimeout(resolve, 400));

         try {
            return await load();
         } catch (second: unknown) {
            if (isChunkFailure(second) && reloadOnce()) {
               /* The reload is on its way. Hold rather than flashing an error
                * the reader would only see for a moment. */
               return await new Promise<{ default: T }>(() => {});
            }
            throw second;
         }
      })
   );
}

type State = { failed: boolean };

/**
 * The last line of defence: a route that throws on the way in gets a page that
 * says so and offers the one thing that fixes it, rather than white space.
 */
export class RouteBoundary extends Component<{ children: ReactNode }, State> {
   state: State = { failed: false };

   static getDerivedStateFromError(): State {
      return { failed: true };
   }

   componentDidCatch(error: unknown) {
      console.error('[route] failed to load', error);
   }

   render() {
      if (!this.state.failed) {
         return this.props.children;
      }

      return (
         <section className="mx-auto w-[min(640px,100%-32px)] py-16">
            <h1 className="g text-[40px] md:text-[52px]">
               That page did not load
            </h1>
            <p className="mt-4 max-w-[52ch] text-base text-ink-2">
               The app was probably updated while this tab was open. Loading it
               again picks up the new version.
            </p>
            <button
               type="button"
               onClick={() => {
                  clearChunkReloadMark();
                  window.location.reload();
               }}
               className="g-tracked mt-6 inline-flex min-h-11 items-center border border-ink px-5 text-[17px] transition-colors duration-150 [transition-timing-function:var(--ease)] hover:bg-bg-2"
            >
               Load it again
            </button>
         </section>
      );
   }
}
