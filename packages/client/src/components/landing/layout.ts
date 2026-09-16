import type { CSSProperties } from 'react';

/** The page gutter: 16px on phones, 24px from md, capped at 1200px. */
export const WRAP =
   'mx-auto w-[min(1200px,100%-32px)] md:w-[min(1200px,100%-48px)]';

/** Anchored sections clear the 60px sticky header when jumped to. */
export const ANCHOR = 'scroll-mt-[60px]';

/** Holds a `.rv` reveal back by 90ms a step, so a block arrives in reading order. */
export const stagger = (i: number) => ({ '--i': i }) as CSSProperties;
