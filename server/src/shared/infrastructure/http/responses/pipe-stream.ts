import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { Response } from 'express';
import type { Readable } from 'node:stream';

export const pipeStreamToResponse = (
    res: Response,
    stream: Readable,
    headers: Record<string, string>
): Promise<void> => {
    return new Promise<void>((resolve) => {
        for(const [name, value] of Object.entries(headers)){
            if(name.toLowerCase() === 'vary'){
                res.vary(value);
                continue;
            }

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
