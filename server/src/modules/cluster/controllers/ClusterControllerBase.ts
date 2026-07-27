import Controller from '@shared/http/Controller';
import ClusterService from '@modules/cluster/services/ClusterService';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

export default abstract class ClusterControllerBase extends Controller {
    protected readonly service = new ClusterService();

    protected params<T>(req: AuthenticatedRequest): T {
        return buildControllerParams(req) as unknown as T;
    }

    protected sendPaginated<T>(res: Response, value: PaginatedResult<T>): void {
        BaseResponse.paginated(res, value, value._meta);
    }

    protected pipeStream(res: Response, stream: Readable, headers: Record<string, string>): Promise<void> {
        return new Promise<void>((resolve) => {
            for (const [name, value] of Object.entries(headers)) {
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

                if (!res.headersSent) {
                    BaseResponse.fromError(res, error);
                } else {
                    res.destroy(error instanceof Error ? error : undefined);
                }

                resolve();
            });

            stream.pipe(res);
        });
    }
}
