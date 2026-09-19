import { prisma } from '../lib/prisma';

/*
 * Private marks on the map.
 *
 * Every query here is scoped by userId, without exception and without an
 * override. A waypoint is the most closely held thing an angler has, and the
 * promise the interface makes is that nobody else ever sees one, so the safest
 * shape is a service that has no way to ask for somebody else's.
 */

export type WaypointKind = 'MARK' | 'ACCESS' | 'HAZARD' | 'PARKING' | 'BAIT';

export type WaypointInput = {
   name: string;
   note?: string | null;
   kind: WaypointKind;
   latitude: number;
   longitude: number;
};

const SELECT = {
   id: true,
   name: true,
   note: true,
   kind: true,
   latitude: true,
   longitude: true,
   createdAt: true,
} as const;

export const waypointsService = {
   async listMine(userId: string) {
      return prisma.waypoint.findMany({
         where: { userId, deletedAt: null },
         orderBy: { createdAt: 'desc' },
         take: 500,
         select: SELECT,
      });
   },

   async create(userId: string, input: WaypointInput) {
      return prisma.waypoint.create({
         data: {
            userId,
            name: input.name,
            note: input.note ?? null,
            kind: input.kind,
            latitude: input.latitude,
            longitude: input.longitude,
         },
         select: SELECT,
      });
   },

   async update(userId: string, id: string, input: Partial<WaypointInput>) {
      /* updateMany, so the userId is part of the match rather than a check
       * somebody can forget to write. A waypoint that is not yours simply
       * matches nothing. */
      const result = await prisma.waypoint.updateMany({
         where: { id, userId, deletedAt: null },
         data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
            ...(input.kind !== undefined ? { kind: input.kind } : {}),
            ...(input.latitude !== undefined
               ? { latitude: input.latitude }
               : {}),
            ...(input.longitude !== undefined
               ? { longitude: input.longitude }
               : {}),
         },
      });

      if (result.count === 0) {
         return null;
      }

      return prisma.waypoint.findFirst({
         where: { id, userId },
         select: SELECT,
      });
   },

   async remove(userId: string, id: string) {
      /* Soft delete, like catches and spots: a mark dropped by mistake is
       * recoverable, and the map simply stops drawing it. */
      const result = await prisma.waypoint.updateMany({
         where: { id, userId, deletedAt: null },
         data: { deletedAt: new Date() },
      });
      return result.count > 0;
   },
};
