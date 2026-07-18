import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import ClusterControllerBase from '@modules/cluster/controllers/ClusterControllerBase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { clusterLifecycleRoutes } from '@volt/contracts/modules/cluster/routes';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

export default class ClusterLifecycleController extends ClusterControllerBase {
    @Route(clusterLifecycleRoutes.processHealthcheck)
    async processHealthcheck(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.processHealthcheck(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(clusterLifecycleRoutes.generateInstallManifest)
    async generateInstallManifest(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.generateInstallManifest(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
