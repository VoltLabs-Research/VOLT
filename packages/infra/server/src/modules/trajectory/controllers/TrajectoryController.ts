import typia from 'typia';
import { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res, Param, Query, Body, schemaBody, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import TrajectoryControllerBase from '@modules/trajectory/controllers/TrajectoryControllerBase';
import { respondWithTrajectoryPreview } from '@modules/trajectory/controllers/trajectory-preview-response';
import { HttpStatus } from '@shared/http/constants/HttpStatus';
import BaseResponse from '@shared/http/responses/BaseResponse';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';
import { pipeStreamToResponse } from '@shared/http/responses/pipe-stream';
import trajectoryUploadSessionService from '@modules/trajectory/services/trajectory/TrajectoryUploadSessionService';
import trajectoryCatalogService from '@modules/trajectory/services/trajectory/TrajectoryCatalogService';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import { getTrajectoryPreview } from '@modules/trajectory/services/trajectory/TrajectoryPreviewService';
import { cloneTrajectory } from '@modules/trajectory/services/trajectory/TrajectoryCloneService';
import trajectoryDownloadService from '@modules/trajectory/services/trajectory/TrajectoryDownloadService';
import { getTrajectoryAtoms } from '@modules/trajectory/services/trajectory/TrajectoryAtomsService';
import sceneArtifactQueryService from '@modules/trajectory/services/trajectory/SceneArtifactQueryService';
import colorCodingService from '@modules/trajectory/services/color-coding/ColorCodingService';
import particleFilterService from '@modules/trajectory/services/particle-filter/ParticleFilterService';
import exposureOctreeService from '@modules/trajectory/services/exposure-octree/ExposureOctreeService';

@Middleware(protect, teamScoped(Resource.TRAJECTORY))
export default class TrajectoryController extends TrajectoryControllerBase {
    @Route(trajectoryRoutes.listSamples)
    async listSamples(@Res() res: Response): Promise<void> {
        const value = await trajectoryDownloadService.listSamples();
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.downloadSamples)
    async downloadSamples(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await trajectoryDownloadService.downloadSamples(this.params(req));
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
        this.sendPaginated(res, await sceneArtifactQueryService.listByTeam(this.params(req)));
    }

    @Route(trajectoryRoutes.createUploadSession)
    async createUploadSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await trajectoryUploadSessionService.create(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(trajectoryRoutes.commitUploadSession)
    async commitUploadSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await trajectoryUploadSessionService.commit(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.cancelUploadSession)
    async cancelUploadSession(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        await trajectoryUploadSessionService.cancel(this.params(req, this.withAuthenticatedUserId));
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.list)
    async getByTeamId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await trajectoryCatalogService.getByTeamId(this.params(req)));
    }

    @Route(trajectoryRoutes.clone)
    async cloneTrajectory(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await cloneTrajectory(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Accepted);
    }

    @Route(trajectoryRoutes.listFolders)
    async listFolders(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>,
        @Res() res: Response
    ): Promise<void>{
        const result = await trajectoryCatalogService.listFolders(teamId, {
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
        const folder = await trajectoryCatalogService.getFolder(teamId, folderId);
        BaseResponse.success(res, folder);
    }

    @Route(trajectoryRoutes.createFolder)
    async createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<{ title: string; parentId?: string | null }>())) body: { title: string; parentId?: string | null },
        @Res() res: Response
    ): Promise<void> {
        const folder = await trajectoryCatalogService.createFolder(teamId, userId, body);
        BaseResponse.success(res, folder, HttpStatus.Created);
    }

    @Route(trajectoryRoutes.updateFolder)
    async updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body(schemaBody(typia.createValidate<{ title: string }>())) body: { title: string },
        @Res() res: Response
    ): Promise<void> {
        const folder = await trajectoryCatalogService.updateFolder(teamId, folderId, body.title);
        BaseResponse.success(res, folder);
    }

    @Route(trajectoryRoutes.removeFolder)
    async removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Res() res: Response
    ): Promise<void>{
        await trajectoryCatalogService.deleteFolder(teamId, folderId);
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.getMetrics)
    async getMetrics(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await teamMetricsQueryService.getTeamMetrics(this.params(req));
        BaseResponse.success(res, value);
    }

    @Route(trajectoryRoutes.getPreview)
    async getPreview(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        await respondWithTrajectoryPreview(res, () => getTrajectoryPreview(this.params<{ trajectoryId: string }>(req).trajectoryId));
    }

    @Route(trajectoryRoutes.downloadAnalyses)
    async downloadTrajectoryAnalyses(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await trajectoryDownloadService.downloadTrajectoryAnalyses(this.params(req));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.download)
    async downloadTrajectory(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await trajectoryDownloadService.downloadTrajectory(this.params(req));
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

        const value = await getTrajectoryAtoms(this.buildAtomsInput(req));
        this.sendAtomsBinary(res, value);
    }

    @Route(trajectoryRoutes.getSceneArtifacts)
    async getSceneArtifacts(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await sceneArtifactQueryService.listByTrajectory(this.params(req)));
    }

    @Route(trajectoryRoutes.move)
    async move(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await trajectoryCatalogService.move(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.get)
    async getById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await trajectoryCatalogService.getById(this.params<{ trajectoryId: string }>(req).trajectoryId);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.update)
    async updateById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await trajectoryCatalogService.updateById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.remove)
    async deleteById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        await trajectoryCatalogService.deleteById(this.params(req));
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.colorCodingProperties)
    async colorCodingGetProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await colorCodingService.getProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.colorCodingStats)
    async colorCodingGetStats(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await colorCodingService.getStats(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.colorCodingModel)
    async colorCodingGet(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await colorCodingService.getModelStreamResponse(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.colorCodingCreate)
    async colorCodingCreate(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        await colorCodingService.createColoredModel(this.params(req));
        BaseResponse.success(res, null, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterProperties)
    async particleFilterGetProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await particleFilterService.getProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterPreview)
    async particleFilterPreview(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await particleFilterService.preview(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterUniqueValues)
    async particleFilterGetUniqueValues(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await particleFilterService.getUniqueValues(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterModel)
    async particleFilterGet(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await particleFilterService.getModelStreamResponse(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.particleFilterApply)
    async particleFilterApplyAction(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await particleFilterService.applyAction(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.lodOctreeMetadata)
    async lodGetOctreeMetadata(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await exposureOctreeService.getOctreeMetadataStreamResponse(this.params(req));
        await pipeStreamToResponse(res, output.stream, this.defaultStreamHeaders());
    }
}
