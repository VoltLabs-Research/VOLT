import { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import ClusterControllerBase from '@modules/cluster/controllers/ClusterControllerBase';
import ClusterService from '@modules/cluster/services/ClusterService';
import clusterDemoService from '@modules/cluster/services/ClusterDemoService';
import clusterRemoteExplorerService from '@modules/cluster/services/ClusterRemoteExplorerService';
import clusterRuntimeSettingsService from '@modules/cluster/services/ClusterRuntimeSettingsService';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';

import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';
import { pipeStreamToResponse } from '@shared/infrastructure/http/responses/pipe-stream';

@Middleware(protect, teamScoped(Resource.TEAM))
export default class ClusterController extends ClusterControllerBase {
    readonly #service = new ClusterService();

    @Route(teamClusterRoutes.list)
    async listByTeamId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.#service.listByTeamId(this.params(req)));
    }

    @Route(teamClusterRoutes.create)
    async create(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.create(this.params(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(teamClusterRoutes.provisionDemo)
    async provisionDemo(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterDemoService.provisionDemo(this.params(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(teamClusterRoutes.deleteDemo)
    async deleteDemo(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterDemoService.deleteDemo(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getDemoStatus)
    async getDemoStatus(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterDemoService.getDemoStatus(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getById)
    async getById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.getById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getRuntimeSnapshot)
    async getRuntimeSnapshot(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRuntimeSettingsService.getRuntimeSnapshot(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.updateQueueConcurrency)
    async updateQueueConcurrency(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRuntimeSettingsService.updateQueueConcurrency(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.updateRole)
    async updateRole(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRuntimeSettingsService.updateRole(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.listTransferJobs)
    async listTransferJobs(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.#service.listTransferJobs(this.params(req)));
    }

    @Route(teamClusterRoutes.createTransferRequest)
    async createTransferRequest(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.createTransferRequest(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getResourceLimits)
    async getResourceLimits(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRuntimeSettingsService.getResourceLimits(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Middleware(RATE_LIMIT_POLICIES.passwordConfirmedClusterAction)
    @Route(teamClusterRoutes.revealCredentials)
    async revealCredentials(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.revealCredentials(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Middleware(RATE_LIMIT_POLICIES.passwordConfirmedClusterAction)
    @Route(teamClusterRoutes.createRemoteAccessSession)
    async createRemoteAccessSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRemoteExplorerService.createRemoteAccessSession(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.listRemoteExplorerEntries)
    async listRemoteExplorerEntries(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRemoteExplorerService.listRemoteExplorerEntries(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.getRemoteExplorerNode)
    async getRemoteExplorerNode(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await clusterRemoteExplorerService.getRemoteExplorerNode(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(teamClusterRoutes.downloadRemoteExplorerObject)
    async downloadRemoteExplorerObject(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await clusterRemoteExplorerService.downloadRemoteExplorerObject(this.params(req));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(teamClusterRoutes.regenerateEnrollmentToken)
    async regenerateEnrollmentToken(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.regenerateEnrollmentToken(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Middleware(RATE_LIMIT_POLICIES.passwordConfirmedClusterAction)
    @Route(teamClusterRoutes.deleteById)
    async deleteById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.deleteById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
