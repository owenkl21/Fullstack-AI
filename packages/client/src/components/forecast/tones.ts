/*
 * A little colour, where it says something. Wind in four bands a shore
 * angler already thinks in: light, fishable, strong, blown out. The sky in
 * the colour of the sky. Everything else stays ink, so the colour is read as
 * a signal rather than decoration.
 */
export const windTone = (kph: number | null) =>
   kph === null
      ? ''
      : kph < 15
        ? 'text-ink-2'
        : kph < 30
          ? 'text-teal-text'
          : kph < 45
            ? 'text-[#c97b1c]'
            : 'text-[#c0392b]';

export const skyTone = (text: string | null | undefined) => {
   const t = (text ?? '').toLowerCase();
   if (/thunder|storm/.test(t)) return 'text-[#8e44ad]';
   if (/rain|drizzle|shower/.test(t)) return 'text-[#1f6fb2]';
   if (/fog|mist/.test(t)) return 'text-ink-3';
   if (/overcast/.test(t)) return 'text-ink-2';
   if (/cloud/.test(t)) return 'text-ink-2';
   return 'text-[#d99a1a]';
};
