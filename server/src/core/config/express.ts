import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import './env';
import logger from '@shared/infrastructure/logger';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

const corsOptions = {
    origin: function (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
        if (!origin) return callback(null, true);

        let allowedOrigins: string[];
        if (process.env.NODE_ENV === 'production') {
            allowedOrigins = [process.env.CLIENT_HOST as string];
        } else {
            allowedOrigins = [process.env.CLIENT_DEV_HOST as string];
        }

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
        'If-Modified-Since',
        'User-Agent'
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

export default app;
