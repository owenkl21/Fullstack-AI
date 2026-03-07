import type { Request, Response } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { userService } from '../services/user.service';

export const webhookController = {
   async handleClerkWebhook(req: Request, res: Response) {
      try {
         const event = await verifyWebhook(req);

         switch (event.type) {
            case 'user.created':
            case 'user.updated': {
               await userService.syncAuthenticatedUser(event.data.id);
               break;
            }
            case 'user.deleted': {
               if (event.data.id) {
                  await userService.deleteByClerkId(event.data.id);
               }
               break;
            }
            default:
               break;
         }

         return res.status(200).json({ received: true });
      } catch (error) {
         console.error('[webhook:error]', error);
         return res.status(400).json({
            code: 'invalid_webhook',
            message: 'Invalid Clerk webhook request.',
         });
      }
   },
};
