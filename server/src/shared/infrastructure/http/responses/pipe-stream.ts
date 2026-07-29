import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { Response } from 'express';
import type { Readable } from 'node:stream';

/**
 * Streams a readable to the HTTP response and resolves once the exchange is
 * over, however it ends: client disconnect, normal finish, or stream error.
 *
 * Errors resolve rather than reject on purpose — the response has already been
 * handed to the client, so the caller has nothing left to decide.
 */
export const pipeStreamToResponse = (
    res: Response,
    stream: Readable,
    headers: Record<string, string>
): Promise<void> => {
    return new Promise<void>((resolve) => {
        for(const [name, value] of Object.entries(headers)){
            res.setHeader(name, value);
        }

        res.on('close', () => {
            stream.destroy();
            resolve();
        });

        res.on('finish', () => {
            resolve();
        });

        stream.on('error', (error: unknown) => {
            logger.error(error);

            if(!res.headersSent){
                BaseResponse.fromError(res, error);
            }else{
                res.destroy(error instanceof Error ? error : undefined);
            }

            resolve();
        });

        stream.pipe(res);
    });
};
