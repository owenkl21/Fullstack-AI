/*
 * Screens that are a task rather than a place.
 *
 * They carry their own way out and their own primary action, so the phone
 * navigation stands down on them: the raised teal key was landing on top of the
 * teal save bar, and two teal blocks fighting over one corner of a phone is
 * worse than no navigation for the length of one form.
 */
export const TASK_ROUTES = ['/log'];

export const isTaskRoute = (pathname: string) => TASK_ROUTES.includes(pathname);
