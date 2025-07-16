import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import app from '@config/express';
import mongoConnector from '@utilities/mongoConnector';

const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

app.listen(SERVER_PORT as number, SERVER_HOST, async () => {
    await mongoConnector();
    console.log(`Server running at http://${SERVER_HOST}:${SERVER_PORT}/`);
});