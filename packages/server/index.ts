import express from 'express';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import router from './routes';
import { auth } from './lib/auth';
import { requestScope } from './lib/auth-context';
import { prisma } from './lib/prisma';

//reads variables from .env file and adds them to process.env
dotenv.config();

const app = express();

/*
 * An auth URL can carry a live token, in the query of a verification link and
 * in the path of a reset link, so for those only the shape is logged.
 */
const loggable = (url: string) =>
   url.startsWith('/api/auth')
      ? url
           .split('?')[0]!
           .replace(/\/reset-password\/[^/]+/, '/reset-password/:token')
      : url;

/*
 * Ahead of the auth handler, which answers without calling next(). Below it,
 * no sign-in, reset or verification request was ever logged, and neither was
 * the 429 that turns one away. It reads no body, so it costs better-auth
 * nothing.
 */
app.use((req, res, next) => {
   const startedAt = Date.now();
   const url = loggable(req.originalUrl);

   console.log(`[request:start] ${req.method} ${url}`);

   let completed = false;

   const cleanup = () => {
      if (completed) {
         return;
      }

      completed = true;
      console.log(
         `[request:end] ${req.method} ${url} ${res.statusCode} ${Date.now() - startedAt}ms`
      );
   };

   res.on('finish', cleanup);
   res.on('close', cleanup);

   next();
});

/*
 * First of the handlers, before anything that reads the body. better-auth
 * needs the raw request stream, and a body parser consumes it before the
 * handler ever runs. On Express 5 the wildcard is *splat, not *.
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

/* Each request gets its own viewer, filled in once the session is read. */
app.use(requestScope);

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
