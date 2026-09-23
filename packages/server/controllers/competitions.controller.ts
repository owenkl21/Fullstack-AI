import type { Request, Response } from 'express';
import { getAuth } from '../lib/auth-context';
import {
   addTeamSchema,
   assignTeamSchema,
   createCompetitionSchema,
   flagEntrySchema,
   joinCompetitionSchema,
   renameTeamSchema,
   inviteSchema,
   listCompetitionsSchema,
   reviewEntrySchema,
   submitEntrySchema,
} from '../schemas/competition.schema';
import {
   UnknownSpeciesError,
   competitionsService,
} from '../services/competitions.service';
import { entriesService } from '../services/competition-entries.service';
import { TeamError, teamsService } from '../services/competition-teams.service';

/*
 * A team rule broken, told in the app's words. A side that is full or teams
 * that are settled is a conflict with the state of things (409); anything
 * else is a request that cannot be right (400).
 */
const teamProblem = (res: Response, error: unknown) => {
   if (!(error instanceof TeamError)) throw error;
   const conflict = [
      'team_full',
      'teams_locked',
      'team_not_empty',
      'name_taken',
   ];
   return res
      .status(
         error.code === 'not_organiser'
            ? 403
            : conflict.includes(error.code)
              ? 409
              : 400
      )
      .json({ code: error.code, message: error.message });
};

/* A team body that failed its schema: the first message, as the form shows it. */
const badTeam = (res: Response, issues: { message: string }[]) =>
   res.status(400).json({
      code: 'bad_team',
      message: issues[0]?.message ?? 'Check the team name.',
   });

/* Express can hand back a repeated route value as an array. */
const asSingleParam = (value: string | string[] | undefined) =>
   Array.isArray(value) ? value[0] : value;

const unauthorized = {
   code: 'unauthorized',
   message: 'Authentication required.',
};

export const competitionsController = {
   async invite(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const parsed = inviteSchema.safeParse(req.body);
      if (!id || !parsed.success) {
         return res.status(400).json({ code: 'bad_invite' });
      }
      const result = await competitionsService.invite(
         auth.userId,
         id,
         parsed.data.userIds
      );
      if (!result) {
         return res.status(404).json({ code: 'competition_not_yours' });
      }
      return res.json(result);
   },

   async myInvites(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({
         invites: await competitionsService.invitesFor(auth.userId),
      });
   },

   async answerInvite(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.inviteId);
      const accept = req.body?.accept === true;
      if (!id) return res.status(400).json({ code: 'invite_id_required' });
      const result = await competitionsService.answerInvite(
         auth.userId,
         id,
         accept
      );
      if (!result) return res.status(404).json({ code: 'invite_not_found' });
      return res.json(result);
   },

   async myFollowers(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      return res.json({
         followers: await competitionsService.followersOf(auth.userId),
      });
   },

   async list(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const query = listCompetitionsSchema.safeParse(req.query);
      const { page, size, tab } = query.success
         ? query.data
         : { page: 1, size: 20, tab: 'all' as const };
      const result = await competitionsService.list(
         auth.userId,
         page,
         size,
         tab
      );
      return res.json({
         competitions: result.items,
         total: result.total,
         page: result.page,
         size: result.size,
      });
   },

   async create(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const parsed = createCompetitionSchema.safeParse(req.body);
      if (!parsed.success) {
         const issue = parsed.error.issues[0];
         return res.status(400).json({
            code: 'bad_competition',
            message: issue?.message ?? 'Check the form.',
            field: issue?.path.join('.') ?? null,
         });
      }

      try {
         const created = await competitionsService.create(
            auth.userId,
            parsed.data
         );
         /* The same shape as the list, so the client can show it at once. */
         const [competition] = await competitionsService.decorate(auth.userId, [
            created,
         ]);
         return res.status(201).json({ competition });
      } catch (error) {
         if (error instanceof UnknownSpeciesError) {
            return res.status(400).json({
               code: 'bad_competition',
               message: error.message,
               field: 'speciesIds',
            });
         }
         console.error('[competitions:create] failed', error);
         return res.status(500).json({
            code: 'failed_to_create_competition',
            message: 'Could not start that competition.',
         });
      }
   },

   async standings(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({
            code: 'competition_id_required',
            message: 'A competition id is required.',
         });
      }

      const result = await competitionsService.standings(id, auth.userId);
      if (!result) {
         return res.status(404).json({
            code: 'competition_not_found',
            message: 'That competition could not be found.',
         });
      }

      return res.json(result);
   },

   async detail(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({ code: 'competition_id_required' });
      }
      const result = await competitionsService.detail(id, auth.userId);
      if (!result) {
         return res.status(404).json({
            code: 'competition_not_found',
            message: 'That competition could not be found.',
         });
      }
      return res.json(result);
   },

   /* Entering a catch, and what becomes of the entry. */

   async submitEntry(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const parsed = submitEntrySchema.safeParse(req.body);
      if (!id || !parsed.success) {
         return res.status(400).json({
            code: 'bad_entry',
            message: parsed.success
               ? 'A competition id is required.'
               : (parsed.error.issues[0]?.message ?? 'Check the entry.'),
         });
      }
      /*
       * The measure photograph is not on the catch, so nothing else ties it
       * to this angler: its key has to be one of their own uploads, or an
       * entry could borrow somebody else's fish on the scale.
       */
      const own = `users/${auth.storagePrefixId ?? auth.userId}/`;
      if (
         parsed.data.measureImage &&
         !parsed.data.measureImage.storageKey.startsWith(own)
      ) {
         return res.status(400).json({
            code: 'bad_entry',
            message: 'That measure photo is not one of yours.',
         });
      }
      try {
         const result = await entriesService.submit(auth.userId, id, {
            catchId: parsed.data.catchId,
            fishImage: parsed.data.fishImage ?? null,
            measureImage: parsed.data.measureImage ?? null,
            declaredValue: parsed.data.declaredValue ?? null,
            areaConfirmed: parsed.data.areaConfirmed,
            photoTakenAt: parsed.data.photoTakenAt ?? null,
            measureTakenAt: parsed.data.measureTakenAt ?? null,
            note: parsed.data.note ?? null,
         });
         if ('error' in result) {
            const messages: Record<typeof result.error, [number, string]> = {
               not_found: [404, 'That competition could not be found.'],
               not_entered: [403, 'Enter the competition first.'],
               pick_team: [409, 'Pick a team first.'],
               not_open: [409, 'The competition has not started yet.'],
               closed: [409, 'The competition has closed.'],
               catch_not_found: [404, 'That catch could not be found.'],
               already_entered: [409, 'That catch is already entered.'],
               measure_photo_required: [
                  400,
                  'A photograph of the fish on the tape or scale is needed.',
               ],
               fish_photo_not_on_catch: [
                  400,
                  'The fish photo has to be one of the catch photos.',
               ],
               same_photo_twice: [
                  400,
                  'The fish and the measure need two different photos.',
               ],
            };
            const [status, message] = messages[result.error];
            return res.status(status).json({ code: result.error, message });
         }
         const entry = await entriesService.shape(result.entry, {
            id: auth.userId,
            organiser: false,
            entrant: true,
         });
         return res.status(201).json({ entry });
      } catch (error) {
         console.error('[entries:submit] failed', error);
         return res.status(500).json({
            code: 'failed_to_enter',
            message: 'Could not enter that catch right now.',
         });
      }
   },

   async getEntry(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const entryId = asSingleParam(req.params.entryId);
      if (!id || !entryId) return res.status(400).json({ code: 'bad_entry' });
      const competition = await entriesService.competitionFor(id);
      const entry = await entriesService.get(entryId);
      if (!competition || !entry || entry.competitionId !== id) {
         return res.status(404).json({ code: 'entry_not_found' });
      }
      const organiser = competition.createdById === auth.userId;
      const entrant = organiser || (await entriesService.isIn(id, auth.userId));
      return res.json({
         entry: await entriesService.shape(entry, {
            id: auth.userId,
            organiser,
            entrant,
         }),
      });
   },

   async withdrawEntry(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const entryId = asSingleParam(req.params.entryId);
      if (!id || !entryId) return res.status(400).json({ code: 'bad_entry' });
      const entry = await entriesService.withdraw(auth.userId, id, entryId);
      if (!entry) return res.status(404).json({ code: 'entry_not_found' });
      return res.status(204).send();
   },

   async reviewEntry(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const entryId = asSingleParam(req.params.entryId);
      const parsed = reviewEntrySchema.safeParse(req.body);
      if (!id || !entryId || !parsed.success) {
         return res.status(400).json({ code: 'bad_review' });
      }
      const result = await entriesService.review(
         auth.userId,
         id,
         entryId,
         parsed.data.action,
         parsed.data.note ?? null
      );
      if ('error' in result) {
         const status =
            result.error === 'not_found'
               ? 404
               : result.error === 'not_organiser'
                 ? 403
                 : 409;
         return res.status(status).json({ code: result.error });
      }
      return res.json({
         entry: await entriesService.shape(result.entry, {
            id: auth.userId,
            organiser: true,
            entrant: true,
         }),
      });
   },

   async flagEntry(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const entryId = asSingleParam(req.params.entryId);
      const parsed = flagEntrySchema.safeParse(req.body);
      if (!id || !entryId || !parsed.success) {
         return res
            .status(400)
            .json({ code: 'bad_flag', message: 'Say what is not right.' });
      }
      const result = await entriesService.flag(
         auth.userId,
         id,
         entryId,
         parsed.data.reason
      );
      if ('error' in result) {
         const status =
            result.error === 'not_found'
               ? 404
               : result.error === 'not_entered'
                 ? 403
                 : 409;
         return res.status(status).json({ code: result.error });
      }
      return res.json({
         entry: await entriesService.shape(result.entry, {
            id: auth.userId,
            organiser: false,
            entrant: true,
         }),
      });
   },

   async join(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({
            code: 'competition_id_required',
            message: 'A competition id is required.',
         });
      }

      const body = joinCompetitionSchema.safeParse(req.body ?? {});
      let result;
      try {
         result = await competitionsService.join(
            auth.userId,
            id,
            body.success ? (body.data.teamId ?? null) : null
         );
      } catch (error) {
         return teamProblem(res, error);
      }
      if (!result) {
         /* Either it is gone, or it belongs to a group this angler is not in.
          * Both are "you cannot enter this", and saying which would leak
          * whether a private competition exists. */
         return res.status(404).json({
            code: 'competition_not_open',
            message: 'That competition is not open to you.',
         });
      }

      return res.json(result);
   },

   async leave(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) {
         return res.status(401).json(unauthorized);
      }

      const id = asSingleParam(req.params.competitionId);
      if (!id) {
         return res.status(400).json({
            code: 'competition_id_required',
            message: 'A competition id is required.',
         });
      }

      return res.json(await competitionsService.leave(auth.userId, id));
   },

   /* The organiser's hand on the teams. */

   async addTeam(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const body = addTeamSchema.safeParse(req.body ?? {});
      if (!id) return res.status(400).json({ code: 'competition_id_required' });
      if (!body.success) return badTeam(res, body.error.issues);
      try {
         return res.json(
            await teamsService.add(id, auth.userId, body.data.name)
         );
      } catch (error) {
         return teamProblem(res, error);
      }
   },

   async renameTeam(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const teamId = asSingleParam(req.params.teamId);
      const body = renameTeamSchema.safeParse(req.body ?? {});
      if (!id || !teamId)
         return res.status(400).json({ code: 'team_id_required' });
      if (!body.success) return badTeam(res, body.error.issues);
      try {
         return res.json(
            await teamsService.rename(id, auth.userId, teamId, body.data.name)
         );
      } catch (error) {
         return teamProblem(res, error);
      }
   },

   async removeTeam(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const teamId = asSingleParam(req.params.teamId);
      if (!id || !teamId)
         return res.status(400).json({ code: 'team_id_required' });
      try {
         return res.json(await teamsService.remove(id, auth.userId, teamId));
      } catch (error) {
         return teamProblem(res, error);
      }
   },

   async assignTeam(req: Request, res: Response) {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json(unauthorized);
      const id = asSingleParam(req.params.competitionId);
      const body = assignTeamSchema.safeParse(req.body ?? {});
      if (!id) return res.status(400).json({ code: 'competition_id_required' });
      if (!body.success) return badTeam(res, body.error.issues);
      try {
         return res.json(
            await teamsService.assign(
               id,
               auth.userId,
               body.data.userId,
               body.data.teamId
            )
         );
      } catch (error) {
         return teamProblem(res, error);
      }
   },
};
