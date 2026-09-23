/*
 * Screens that are a task rather than a place.
 *
 * They carry their own way out and their own primary action, so the phone
 * navigation stands down on them: the raised teal key was landing on top of the
 * teal save bar, and two teal blocks fighting over one corner of a phone is
 * worse than no navigation for the length of one form.
 */
export const TASK_ROUTES = [
   '/log',
   '/catches/new',
   '/catches/:catchId/edit',
   '/competitions/new',
];

/*
 * A pattern is matched a segment at a time rather than by a regular
 * expression, because the only variable a task route carries is an id and a
 * whole segment is exactly what an id is.
 */
const matchesRoute = (pattern: string, pathname: string) => {
   const wanted = pattern.split('/');
   const given = pathname.replace(/\/+$/, '').split('/');
   if (wanted.length !== given.length) {
      return false;
   }
   return wanted.every((part, index) =>
      part.startsWith(':') ? given[index]!.length > 0 : part === given[index]
   );
};

export const isTaskRoute = (pathname: string) =>
   TASK_ROUTES.some((pattern) => matchesRoute(pattern, pathname));
