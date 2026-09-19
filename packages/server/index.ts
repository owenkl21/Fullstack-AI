import express from 'express';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import router from './routes';
import { auth } from './lib/auth';
import { prisma } from './lib/prisma';

//reads variables from .env file and adds them to process.env
dotenv.config();

const app = express();

/*
 * First, before anything that reads the body. better-auth needs the raw
 * request stream, and a body parser consumes it before the handler ever runs.
 * On Express 5 the wildcard is *splat, not *.
 */
app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(
   '/api/uploads/proxy',
   express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: '10mb',
   })
);

app.use(express.json());
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
