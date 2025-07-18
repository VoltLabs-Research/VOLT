import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { configureApp } from '@utilities/bootstrap';

const app = express();

const corsOptions = {
    origin: function (origin: string | undefined, callback: Function){
        if(!origin) return callback(null, true);

        // TODO: client_host may be undefined because using dotenv in this file.
        const allowedOrigins = process.env.NODE_ENV === 'production' 
            ? [process.env.CLIENT_HOST as string]
            : [
                process.env.CLIENT_DEV_HOST as string
              ];
        
        if(allowedOrigins.includes(origin)){
            callback(null, true);
        }else{
            console.log(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    optionsSuccessStatus: 200
};

configureApp({
    app,
    suffix: '/api/',
    routes: [
        'dislocations',
        'trajectories',
        'auth'
    ],
    middlewares: [
        cors(corsOptions),
        helmet(),
        compression(),
        bodyParser.json(),
        bodyParser.urlencoded({ extended: true })
    ]
});

export default app;