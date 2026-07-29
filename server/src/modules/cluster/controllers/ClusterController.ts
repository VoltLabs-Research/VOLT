import { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import ClusterControllerBase from '@modules/cluster/controllers/ClusterControllerBase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';

import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';

@Middleware(protect, teamScoped(Resource.TEAM))
export default class ClusterController extends ClusterControllerBase {
    @Route(teamClusterRoutes.list)
    async listByTeamId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.service.listByTeamId(this.params(req)));
    }

    @Route(teamClusterRoutes.create)
    async create(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.create(this.params(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(teamClusterRoutes.provisionDemo)
    async provisionDemo(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.provisionDemo(this.params(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(teamClusterRoutes.deleteDemo)
    async deleteDemo(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.deleteDemo(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getDemoStatus)
    async getDemoStatus(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getDemoStatus(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getById)
    async getById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getRuntimeSnapshot)
    async getRuntimeSnapshot(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getRuntimeSnapshot(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.updateQueueConcurrency)
    async updateQueueConcurrency(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.updateQueueConcurrency(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.updateRole)
    async updateRole(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.updateRole(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.listTransferJobs)
    async listTransferJobs(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.service.listTransferJobs(this.params(req)));
    }

    @Route(teamClusterRoutes.createTransferRequest)
    async createTransferRequest(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.createTransferRequest(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getResourceLimits)
    async getResourceLimits(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getResourceLimits(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Middleware(RATE_LIMIT_POLICIES.passwordConfirmedClusterAction)
    @Route(teamClusterRoutes.revealCredentials)
    async revealCredentials(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.revealCredentials(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Middleware(RATE_LIMIT_POLICIES.passwordConfirmedClusterAction)
    @Route(teamClusterRoutes.createRemoteAccessSession)
    async createRemoteAccessSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.createRemoteAccessSession(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.listRemoteExplorerEntries)
    async listRemoteExplorerEntries(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.listRemoteExplorerEntries(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getRemoteExplorerNode)
    async getRemoteExplorerNode(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getRemoteExplorerNode(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.downloadRemoteExplorerObject)
    async downloadRemoteExplorerObject(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.downloadRemoteExplorerObject(this.params(req));
        await output.prepare?.();
        await this.pipeStream(res, output.stream, output.headers);
    }

    @Route(teamClusterRoutes.regenerateEnrollmentToken)
    async regenerateEnrollmentToken(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.regenerateEnrollmentToken(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Middleware(RATE_LIMIT_POLICIES.passwordConfirmedClusterAction)
    @Route(teamClusterRoutes.deleteById)
    async deleteById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.deleteById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
