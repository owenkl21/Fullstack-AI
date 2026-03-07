import express from 'express';
import type { Request, Response } from 'express';
import { chatController } from './controllers/chat.controller';
import { fishingController } from './controllers/fishing.controller';
import { getAuth } from '@clerk/express';

const router = express.Router();

function requireApiAuth(
   req: Request,
   res: Response,
   next: express.NextFunction
) {
   const auth = getAuth(req);

   if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({
         code: 'unauthorized',
         message: 'Authentication required.',
      });
   }

   return next();
}

router.get('/', (_req: Request, res: Response) => {
   res.send('Hello World!');
});

router.get('/api/hello', (_req: Request, res: Response) => {
   res.json({ message: 'Hello from the API!' });
});

router.post('/api/chat', requireApiAuth, chatController.sendMessage);

router.post(
   '/api/fishing/conditions',
   requireApiAuth,
   fishingController.getConditions
);

export default router;
