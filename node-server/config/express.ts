import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';

import { configureApp } from '@utilities/bootstrap';

const app = express();

configureApp({
    app,
    suffix: '/api/v1/',
    routes: [
    ],
    middlewares: [
        helmet(),
        compression(),
        bodyParser.json(),
        bodyParser.urlencoded({ extended: true })
    ]
});

export default app;