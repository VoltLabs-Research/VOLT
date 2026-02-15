import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import './env';
import logger from '@shared/infrastructure/logger';

const app = express();

// CORE-009: Validate environment variables for CORS origins
const clientHost = process.env.CLIENT_HOST;
const clientDevHost = process.env.CLIENT_DEV_HOST;

if (process.env.NODE_ENV === 'production' && !clientHost) {
    logger.warn('CLIENT_HOST not set, CORS will block all cross-origin requests');
}

const corsOptions = {
    origin: function (origin: string | undefined, callback: Function) {
        if (!origin) return callback(null, true);

        // Filter out undefined values from allowed origins
        const allowedOrigins = (process.env.NODE_ENV === 'production'
            ? [clientHost]
            : [clientDevHost]
        ).filter((o): o is string => !!o);

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
// TODO: Add rate limiting middleware (express-rate-limit) for auth endpoints
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

export default app;
