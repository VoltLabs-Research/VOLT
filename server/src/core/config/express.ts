import './env';
import { requestContextMiddleware, TRACE_ID_HEADER } from '@shared/infrastructure/http/middleware/request-context';
import logger from '@shared/infrastructure/logger';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Request, Response } from 'express';

const app = express();
const captureRawBody = (req: Request, _res: unknown, buffer: Buffer): void => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
};

app.set('trust proxy', 1);

const baseAllowedOrigins = new Set<string>();

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
        'User-Agent',
        TRACE_ID_HEADER
    ],
    exposedHeaders: [
        'Cache-Control',
        'Pragma',
        'Expires',
        'ETag',
        'Last-Modified',
        'Content-Length',
        TRACE_ID_HEADER
    ],
    optionsSuccessStatus: 200
};

for (const origin of [process.env.CLIENT_HOST, process.env.CLIENT_DEV_HOST]) {
    if (!origin) {
        continue;
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (normalizedOrigin) {
        baseAllowedOrigins.add(normalizedOrigin);
    }
}

const corsMiddleware = cors((req, callback) => {
    const allowedOrigins = new Set(baseAllowedOrigins);
    const requestOrigin = normalizeOrigin(`${req.protocol}://${req.get('host') || ''}`);

    if (requestOrigin) {
        allowedOrigins.add(requestOrigin);
    }

    callback(null, {
        ...corsBaseOptions,
        origin: (origin, originCallback) => {
            if (!origin) {
                originCallback(null, true);
                return;
            }

            const normalizedOrigin = normalizeOrigin(origin);
            if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
                originCallback(null, true);
                return;
            }

            logger.info({ origin }, 'CORS blocked origin');
            originCallback(new Error('Not allowed by CORS'));
        }
    });
});

const isBinaryLikeResponse = (res: Response): boolean => {
    const contentDisposition = String(res.getHeader('Content-Disposition') || '').toLowerCase();
    if (contentDisposition.includes('attachment')) {
        return true;
    }

    const rawContentType = String(res.getHeader('Content-Type') || '');
    const contentType = rawContentType.split(';', 1)[0]?.trim().toLowerCase() || '';

    if (!contentType) {
        return false;
    }

    if (contentType.startsWith('image/')
        || contentType.startsWith('audio/')
        || contentType.startsWith('video/')
        || contentType.startsWith('model/')) {
        return true;
    }

    return new Set([
        'application/octet-stream',
        'application/gzip',
        'application/zip',
        'application/x-zip-compressed',
        'application/pdf',
        'application/vnd.ms-excel'
    ]).has(contentType);
};

const shouldCompressResponse = (req: Request, res: Response): boolean => {
    if (isBinaryLikeResponse(res)) {
        return false;
    }

    return compression.filter(req, res);
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            upgradeInsecureRequests: null
        }
    }
}));
app.use(requestContextMiddleware);
app.use(corsMiddleware);

app.use(compression({
    filter: shouldCompressResponse
}));
app.use(express.json({ limit: '1mb', verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, limit: '1mb', verify: captureRawBody }));
app.use(express.static('static'));

export default app;
