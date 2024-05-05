require('dotenv').config()

import express, {Request, Response, Express, Application} from 'express';
import router from './routes/index';

const app:Express = express();
const port: string | number = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use('/api/v1',router);

app.get('/', (req: Request, res: Response) => {
    res.send('Hey!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})