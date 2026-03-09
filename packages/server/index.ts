import express from 'express';
import dotenv from 'dotenv';
import router from './routes';
import { clerkMiddleware } from '@clerk/express';
import { prisma } from './lib/prisma';
import { webhookController } from './controllers/webhook.controller';

//reads variables from .env file and adds them to process.env
dotenv.config();

const app = express();

app.post(
   '/api/webhooks/clerk',
   express.raw({ type: 'application/json' }),
   webhookController.handleClerkWebhook
);

app.use(
   '/api/uploads/proxy',
   express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: '10mb',
   })
);

app.use(express.json());
app.use(clerkMiddleware());
app.use((req, res, next) => {
   const startedAt = Date.now();

   console.log(`[request:start] ${req.method} ${req.originalUrl}`);

   let completed = false;

   const cleanup = () => {
      if (completed) {
         return;
      }

      completed = true;
      console.log(
         `[request:end] ${req.method} ${req.originalUrl} ${Date.now() - startedAt}ms`
      );
   };

   res.on('finish', cleanup);
   res.on('close', cleanup);

   next();
});

app.use(router);

app.use(
   (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
   ) => {
      console.error('[request:error]', error);

      return res.status(500).json({
         code: 'internal_server_error',
         message: 'Unexpected server error',
      });
   }
);

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
   console.log(`Server is running on port http://localhost:${port}`);
});

const shutdown = async () => {
   await prisma.$disconnect();
   server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
