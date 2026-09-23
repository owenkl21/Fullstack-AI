/*
 * Who may be told about a spot.
 *
 * A spot is the thing anglers most want to keep to themselves, and it leaks
 * sideways far more easily than it leaks head on. The list and the page were
 * already closed; the name, the link and the position still rode out on every
 * record that points at a spot: a public catch logged there, the feed post
 * that catch wrote, a post somebody kept. So the rule lives here, once, and
 * every service that hands a spot to a reader asks it the same question.
 *
 * The rule: a spot is for everyone when it is PUBLIC and for its owner
 * otherwise. GROUPS is not PUBLIC. Nothing resolves a group audience for a
 * spot yet, so until something does it reads as private, which is the safe
 * way to be wrong.
 */

export type SiteGate = {
   visibility: 'PRIVATE' | 'GROUPS' | 'PUBLIC';
   createdById: string;
};

/* The two columns a query has to select for the gate to have an answer. */
export const siteGateSelect = { visibility: true, createdById: true } as const;

export const canSeeSite = (
   site: SiteGate | null | undefined,
   viewerId: string | null | undefined
) =>
   Boolean(
      site &&
      (site.visibility === 'PUBLIC' ||
         (viewerId != null && site.createdById === viewerId))
   );

/*
 * The same rule as a where clause, for a query that should never load a
 * hidden spot in the first place.
 */
export const sitesVisibleTo = (viewerId: string | null | undefined) =>
   viewerId
      ? {
           OR: [{ visibility: 'PUBLIC' as const }, { createdById: viewerId }],
        }
      : { visibility: 'PUBLIC' as const };

/*
 * A record that points at a spot, as one reader may see it.
 *
 * When the spot is not theirs to see, the spot goes, and its id with it, so
 * there is no name to read and no link to follow. The position goes too
 * unless the record is the reader's own: a pin dropped while standing on a
 * private mark IS the mark to within a few metres, so handing it to a
 * stranger hands over the spot. The angler who logged it keeps their own
 * pin, because it is their record of where they stood.
 */
export const withSiteShownTo = <
   T extends {
      site: SiteGate | null;
      createdById?: string;
      siteId?: string | null;
      latitude?: number | null;
      longitude?: number | null;
   },
>(
   record: T,
   viewerId: string | null | undefined
): T => {
   if (!record.site || canSeeSite(record.site, viewerId)) {
      return record;
   }

   const own = viewerId != null && record.createdById === viewerId;

   return {
      ...record,
      site: null,
      ...('siteId' in record ? { siteId: null } : {}),
      ...(own || !('latitude' in record)
         ? {}
         : { latitude: null, longitude: null }),
   };
};
