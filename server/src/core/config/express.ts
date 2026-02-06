import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import './env';
import logger from '@shared/infrastructure/logger';

const app = express();

const corsOptions = {
    origin: function (origin: string | undefined, callback: Function) {
        if (!origin) return callback(null, true);

        const allowedOrigins = process.env.NODE_ENV === 'production'
            ? [process.env.CLIENT_HOST as string]
            : [
                process.env.CLIENT_DEV_HOST as string
            ];

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.info(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma',
        'Expires',
        'If-None-Match',
        'If-Modified-Since'
    ],
    exposedHeaders: [
        'Cache-Control',
        'Pragma',
        'Expires',
        'ETag',
        'Last-Modified',
        'Content-Length'
    ],
    optionsSuccessStatus: 200
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

export default app;
