import { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res, Param, Query, Body, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import TrajectoryControllerBase from '@modules/trajectory/controllers/TrajectoryControllerBase';
import {
    sendTrajectoryPreview,
    sendTrajectoryPreviewError
} from '@modules/trajectory/controllers/trajectory-preview-response';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';
import { pipeStreamToResponse } from '@shared/infrastructure/http/responses/pipe-stream';

@Middleware(protect, teamScoped(Resource.TRAJECTORY))
export default class TrajectoryController extends TrajectoryControllerBase {
    @Route(trajectoryRoutes.listSamples)
    async listSamples(@Res() res: Response): Promise<void> {
        const value = await this.service.listSamples();
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.downloadSamples)
    async downloadSamples(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.downloadSamples(this.params(req));
        await pipeStreamToResponse(res, output.stream, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${output.filename}"`
        });
    }

    @Route(trajectoryRoutes.listTeamSceneArtifacts)
    async listTeamSceneArtifacts(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.service.listTeamSceneArtifacts(this.params(req)));
    }

    @Route(trajectoryRoutes.createUploadSession)
    async createUploadSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.createUploadSession(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(trajectoryRoutes.commitUploadSession)
    async commitUploadSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.commitUploadSession(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.cancelUploadSession)
    async cancelUploadSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        await this.service.cancelUploadSession(this.params(req, this.withAuthenticatedUserId));
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.list)
    async getByTeamId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.service.getByTeamId(this.params(req)));
    }

    @Route(trajectoryRoutes.clone)
    async cloneTrajectory(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.cloneTrajectory(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Accepted);
    }

    @Route(trajectoryRoutes.listFolders)
    async listFolders(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>,
        @Res() res: Response
    ): Promise<void>{
        const result = await this.service.listFolders(teamId, {
            page: query.page ? Number(query.page) : undefined,
            limit: query.limit ? Number(query.limit) : undefined,
            parentId: query.parentId
        });
        BaseResponse.paginated(res, result);
    }

    @Route(trajectoryRoutes.getFolder)
    async getFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Res() res: Response
    ): Promise<void>{
        const folder = await this.service.getFolder(teamId, folderId);
        BaseResponse.success(res, folder);
    }

    @Route(trajectoryRoutes.createFolder)
    async createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: { title: string; parentId?: string | null },
        @Res() res: Response
    ): Promise<void> {
        const folder = await this.service.createFolder(teamId, userId, body);
        BaseResponse.success(res, folder, HttpStatus.Created);
    }

    @Route(trajectoryRoutes.updateFolder)
    async updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body() body: { title: string },
        @Res() res: Response
    ): Promise<void> {
        const folder = await this.service.updateFolder(teamId, folderId, body);
        BaseResponse.success(res, folder);
    }

    @Route(trajectoryRoutes.removeFolder)
    async removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Res() res: Response
    ): Promise<void>{
        await this.service.deleteFolder(teamId, folderId);
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.getMetrics)
    async getMetrics(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getTeamMetrics(this.params(req));
        BaseResponse.success(res, value);
    }

    @Route(trajectoryRoutes.getPreview)
    async getPreview(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        try {
            const value = await this.service.getPreview(this.params(req));
            sendTrajectoryPreview(res, value);
        } catch (error) {
            logger.error(error);
            if (res.headersSent) {
                throw error;
            }
            sendTrajectoryPreviewError(res, error);
        }
    }

    @Route(trajectoryRoutes.downloadAnalyses)
    async downloadTrajectoryAnalyses(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.downloadTrajectoryAnalyses(this.params(req));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.download)
    async downloadTrajectory(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.downloadTrajectory(this.params(req));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.getAtoms)
    async getAtomsBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        if (!this.validateAtomsRequest(req, res)) {
            return;
        }

        const value = await this.service.getAtoms(this.buildAtomsInput(req));
        this.sendAtomsBinary(res, value);
    }

    @Route(trajectoryRoutes.getSceneArtifacts)
    async getSceneArtifacts(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.service.getSceneArtifacts(this.params(req)));
    }

    @Route(trajectoryRoutes.move)
    async move(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.move(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.get)
    async getById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.update)
    async updateById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.updateById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.remove)
    async deleteById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        await this.service.deleteById(this.params(req));
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.colorCodingProperties)
    async colorCodingGetProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getColorCodingProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.colorCodingStats)
    async colorCodingGetStats(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getColorCodingStats(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.colorCodingModel)
    async colorCodingGet(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.getColoredModelStream(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.colorCodingCreate)
    async colorCodingCreate(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.createColoredModel(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterProperties)
    async particleFilterGetProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getParticleFilterProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterPreview)
    async particleFilterPreview(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.previewParticleFilter(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterUniqueValues)
    async particleFilterGetUniqueValues(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getParticleFilterUniqueValues(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterModel)
    async particleFilterGet(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.getFilteredModelStream(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.particleFilterApply)
    async particleFilterApplyAction(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.applyParticleFilterAction(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.lineStyleModel)
    async lineStyleGet(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.getLineStyledModelStream(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.lineStyleCreate)
    async lineStyleCreate(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.createLineStyledModel(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.lineStyleRanges)
    async lineStyleGetRanges(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.getLineModelRangesStream(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.lineStyleEntityProperties)
    async lineStyleGetEntityProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.service.getLineEntityProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.lodOctreeMetadata)
    async lodGetOctreeMetadata(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.service.getOctreeMetadataStream(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }
}
