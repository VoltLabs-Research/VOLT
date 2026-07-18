import Controller from '@shared/http/Controller';
import ClusterService from '@modules/cluster/services/ClusterService';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

/**
 * Shared base for the cluster module's pollium-style controllers. It carries the
 * `new`-able {@link ClusterService} the controllers delegate to, the
 * request-assembly (`buildControllerParams`, reproducing the previous generated
 * controllers' merge of params/query/body + `userId`/`authenticatedUserId`) and
 * the response helpers (paginated envelope + stream-pipe) reproduced verbatim
 * from the previous `ClusterController`.
 *
 * Concrete controllers add the `@Route`/`@Middleware`-decorated handlers; every
 * handler writes the response itself (via `@Res()`), so the {@link Controller}
 * base skips its own responder (its `headersSent`/`writableEnded` guard),
 * preserving the exact `BaseResponse` envelopes, status codes and stream
 * headers.
 */
export default abstract class ClusterControllerBase extends Controller {
    protected readonly service = new ClusterService();

    protected params<T>(req: AuthenticatedRequest): T {
        return buildControllerParams(req) as unknown as T;
    }

    protected sendPaginated<T>(res: Response, value: PaginatedResult<T>): void {
        BaseResponse.paginated(res, value, value._meta);
    }

    /**
     * Reproduces the previous `createPreparedDownloadStreamController` /
     * `ClusterController.downloadRemoteExplorerObject` behaviour: applies the
     * response headers, wires the request-close and stream-error handlers, then
     * pipes the binary stream. Resolves once the response has finished (or was
     * closed / errored) so the awaiting handler returns only after the response
     * has been written — the `Controller` base then no-ops on its guard.
     */
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
