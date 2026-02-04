import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import '@config/env';

import passport from '@config/passport';
import { configureApp } from '@utilities/bootstrap';
import { apiTracker } from '@/middlewares/api-tracker';
import { globalErrorHandler } from '@/middlewares/global-error-handler';
import logger from '@/logger';

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

configureApp({
    app,
    suffix: '/api/',
    routes: [
        'health',
        'plugins',
        'teams',
        'team-invitations',
        'analysis-config',
        'daily-activity',
        'team-roles',
        'team-member',
        'raster',
        'trajectories',
        'trajectory-jobs',
        'notifications',
        'trajectory-vfs',
        'color-coding',
        'auth',
        'api-tracker',
        'sessions',
        'chat',
        'ssh-connections',
        'ssh-file-explorer',
        'containers',
        'system',
        'system',
        'particle-filter',
        'simulation-cells'
    ],
    middlewares: [
        apiTracker,
        cors(corsOptions),
        helmet(),
        compression({
            filter: (req, res) => {
                const url = req.url || '';
                if (
                    url.includes('/images-archive') ||
                    url.includes('/glb-archive') ||
                    url.includes('/frame/') ||
                    url.endsWith('.png') ||
                    url.endsWith('.glb') ||
                    url.endsWith('.zip')
                ) {
                    return false;
                }
                // Default filter
                // @ts-ignore - types accept(req,res) => boolean
                return compression.filter(req as any, res as any);
            }
        }),
        bodyParser.json(),
        bodyParser.urlencoded({ extended: true }),
        passport.initialize()
    ],
    errorHandler: globalErrorHandler
});

export default app;
