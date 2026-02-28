import express from 'express';
import type { Request, Response } from 'express';
import dotenv from "dotenv";

//reads variables from .env file and adds them to process.env
dotenv.config();

const app = express();
const port =  process.env.PORT || 3000;


app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
})