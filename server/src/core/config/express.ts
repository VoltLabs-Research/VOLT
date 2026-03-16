import './env';
import logger from '@shared/infrastructure/logger';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

const app = express();

app.set('trust proxy', 1);

const normalizeOrigin = (value: string): string | null => {
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const corsBaseOptions = {
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

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            upgradeInsecureRequests: null
        }
    }
}));
app.use((req, res, next) => {
    const allowedOrigins = new Set<string>();
    const requestOrigin = normalizeOrigin(`${req.protocol}://${req.get('host') || ''}`);

    for (const origin of [process.env.CLIENT_HOST, process.env.CLIENT_DEV_HOST, requestOrigin]) {
        if (origin) {
            const normalizedOrigin = normalizeOrigin(origin);
            if (normalizedOrigin) {
                allowedOrigins.add(normalizedOrigin);
            }
        }
    }

    cors({
        ...corsBaseOptions,
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }

            const normalizedOrigin = normalizeOrigin(origin);
            if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
                callback(null, true);
                return;
            }

            logger.info(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    })(req, res, next);
});

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static('static'));

export default app;
