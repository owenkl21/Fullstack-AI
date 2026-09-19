/*
 * "Sat 19 Sep": the weekday, the day, the month, in that order, whatever the
 * reader's locale would otherwise put first. The words themselves still come
 * from their locale.
 *
 * In a file of its own rather than beside the component that draws it, so the
 * dev server can still refresh that component on its own.
 */
export const dayStamp = (date: Date) =>
   `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString(undefined, { month: 'short' })}`;
