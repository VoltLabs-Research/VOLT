import Controller from '@shared/http/Controller';
import ClusterService from '@modules/cluster/services/ClusterService';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';

import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';

export default abstract class ClusterControllerBase extends Controller {
    protected readonly service = new ClusterService();

    protected params<T>(req: AuthenticatedRequest): T {
        return buildControllerParams(req) as unknown as T;
    }

    protected sendPaginated<T>(res: Response, value: PaginatedResult<T>): void {
        BaseResponse.paginated(res, value, value._meta);
    }

}
