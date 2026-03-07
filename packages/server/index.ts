import express from 'express';
import dotenv from 'dotenv';
import router from './routes';
import { clerkMiddleware } from '@clerk/express';

//reads variables from .env file and adds them to process.env
dotenv.config();

const app = express();

app.use(express.json());
app.use(clerkMiddleware());

app.use(router);

const port = process.env.PORT || 3000;

app.listen(port, () => {
   console.log(`Server is running on port http://localhost:${port}`);
});
