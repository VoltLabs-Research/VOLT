import { secureCompare } from '../../utilities/compare';
import type { NextFunction, Request, Response } from 'express';

export const createDaemonAuthMiddleware = (daemonPassword: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authorizationHeader = req.headers.authorization;
        const secretHeader = req.headers['x-volt-cluster-secret'];

        const bearerToken = typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')
            ? authorizationHeader.slice('Bearer '.length)
            : undefined;
        const providedSecret = typeof secretHeader === 'string'
            ? secretHeader
            : bearerToken;

        if (!providedSecret || !secureCompare(providedSecret, daemonPassword)) {
            res.status(401).json({
                status: 'error',
                message: 'Unauthorized'
            });
            return;
        }

        next();
    };
};
