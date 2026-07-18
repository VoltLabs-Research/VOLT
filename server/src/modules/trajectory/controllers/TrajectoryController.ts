import { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import TrajectoryControllerBase from '@modules/trajectory/controllers/TrajectoryControllerBase';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import TrajectoryFolderRepository from '@modules/trajectory/repositories/trajectory/TrajectoryFolderRepository';
import { presentTeamMetrics } from '@modules/trajectory/presenters/trajectory';
import {
    sendTrajectoryPreview,
    sendTrajectoryPreviewError
} from '@modules/trajectory/controllers/trajectory-preview-response';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';
import { container } from 'tsyringe';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

/**
 * Team-scoped trajectory HTTP controller (pollium style): one router covering
 * the trajectory, color-coding, particle-filter, line-style and lod groups —
 * all previously mounted under their own `/api/…/:teamId` base paths with
 * `protect` + team-scope on `Resource.TRAJECTORY`, now expressed as a single
 * class-level `@Middleware(protect, teamScoped(Resource.TRAJECTORY))`. Every
 * handler writes the response itself (`@Res()`), reproducing the previous
 * controllers' `BaseResponse` envelopes, status codes and stream headers
 * verbatim. `@Route` methods are declared in the old route-file order so Express
 * matches literal segments before `/:trajectoryId` / `/:analysisId`.
 */
@Middleware(protect, teamScoped(Resource.TRAJECTORY))
export default class TrajectoryController extends TrajectoryControllerBase {
    #folderHandlers = createCatalogFolderRouteHandlers({
        repository: container.resolve(TrajectoryFolderRepository),
        folderLabel: 'Trajectory folder',
        deleteFolder: (input) => container.resolve(DeleteTrajectoryFolderUseCase).execute(input),
        deleteStatusCode: HttpStatus.NoContent
    });

    // --- Trajectory (/api/trajectories/:teamId) ---------------------------

    @Route(trajectoryRoutes.listSamples)
    async listSamples(@Res() res: Response): Promise<void> {
        const value = await this.service.listSamples();
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.downloadSamples)
    async downloadSamples(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.downloadSamples(this.params(req));
        await this.pipeStream(res, output.stream, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${output.filename}"`
        });
    }

    @Route(trajectoryRoutes.listTeamSceneArtifacts)
    async listTeamSceneArtifacts(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.listTeamSceneArtifacts(this.params(req)));
    }

    @Route(trajectoryRoutes.createUploadSession)
    async createUploadSession(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.createUploadSession(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(trajectoryRoutes.commitUploadSession)
    async commitUploadSession(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.commitUploadSession(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.cancelUploadSession)
    async cancelUploadSession(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        await this.service.cancelUploadSession(this.params(req, this.withAuthenticatedUserId));
        res.status(HttpStatus.NoContent).send();
    }

    @Route(trajectoryRoutes.list)
    async getByTeamId(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.getByTeamId(this.params(req)));
    }

    @Route(trajectoryRoutes.clone)
    async cloneTrajectory(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.cloneTrajectory(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Accepted);
    }

    @Route(trajectoryRoutes.listFolders)
    listFolders(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        return this.#folderHandlers.list(req, res);
    }

    @Route(trajectoryRoutes.getFolder)
    getFolder(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        return this.#folderHandlers.get(req, res);
    }

    @Route(trajectoryRoutes.createFolder)
    createFolder(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        return this.#folderHandlers.create(req, res);
    }

    @Route(trajectoryRoutes.updateFolder)
    updateFolder(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        return this.#folderHandlers.update(req, res);
    }

    @Route(trajectoryRoutes.removeFolder)
    removeFolder(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        return this.#folderHandlers.delete(req, res);
    }

    @Route(trajectoryRoutes.getMetrics)
    async getMetrics(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getTeamMetrics(this.params(req));
        BaseResponse.success(res, presentTeamMetrics(value));
    }

    @Route(trajectoryRoutes.getPreview)
    async getPreview(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
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
    async downloadTrajectoryAnalyses(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.downloadTrajectoryAnalyses(this.params(req));
        await output.prepare?.();
        await this.pipeStream(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.download)
    async downloadTrajectory(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.downloadTrajectory(this.params(req));
        await output.prepare?.();
        await this.pipeStream(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.getAtoms)
    async getAtomsBinary(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        if (!this.validateAtomsRequest(req, res)) {
            return;
        }

        const value = await this.service.getAtoms(this.buildAtomsInput(req));
        this.sendAtomsBinary(res, value);
    }

    @Route(trajectoryRoutes.getSceneArtifacts)
    async getSceneArtifacts(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.getSceneArtifacts(this.params(req)));
    }

    @Route(trajectoryRoutes.move)
    async move(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.move(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.get)
    async getById(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.update)
    async updateById(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.updateById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.remove)
    async deleteById(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        await this.service.deleteById(this.params(req));
        res.status(HttpStatus.NoContent).send();
    }

    // --- Color coding (/api/color-codings/:teamId) ------------------------

    @Route(trajectoryRoutes.colorCodingProperties)
    @Route(trajectoryRoutes.colorCodingPropertiesByAnalysis)
    async colorCodingGetProperties(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getColorCodingProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.colorCodingStats)
    @Route(trajectoryRoutes.colorCodingStatsByAnalysis)
    async colorCodingGetStats(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getColorCodingStats(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.colorCodingModel)
    @Route(trajectoryRoutes.colorCodingModelByAnalysis)
    async colorCodingGet(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getColoredModelStream(this.params(req));
        await this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.colorCodingCreate)
    @Route(trajectoryRoutes.colorCodingCreateByAnalysis)
    async colorCodingCreate(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.createColoredModel(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    // --- Particle filter (/api/particle-filters/:teamId) ------------------

    @Route(trajectoryRoutes.particleFilterProperties)
    @Route(trajectoryRoutes.particleFilterPropertiesByAnalysis)
    async particleFilterGetProperties(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getParticleFilterProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterPreview)
    @Route(trajectoryRoutes.particleFilterPreviewByAnalysis)
    async particleFilterPreview(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.previewParticleFilter(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterUniqueValues)
    @Route(trajectoryRoutes.particleFilterUniqueValuesByAnalysis)
    async particleFilterGetUniqueValues(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getParticleFilterUniqueValues(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.particleFilterModel)
    @Route(trajectoryRoutes.particleFilterModelByAnalysis)
    async particleFilterGet(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getFilteredModelStream(this.params(req));
        await this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.particleFilterApply)
    @Route(trajectoryRoutes.particleFilterApplyByAnalysis)
    async particleFilterApplyAction(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.applyParticleFilterAction(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    // --- Line style (/api/line-styles/:teamId) ----------------------------

    @Route(trajectoryRoutes.lineStyleModel)
    async lineStyleGet(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getLineStyledModelStream(this.params(req));
        await this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.lineStyleCreate)
    async lineStyleCreate(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.createLineStyledModel(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.lineStyleRanges)
    async lineStyleGetRanges(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getLineModelRangesStream(this.params(req));
        await this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    }

    @Route(trajectoryRoutes.lineStyleEntityProperties)
    async lineStyleGetEntityProperties(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getLineEntityProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    // --- LOD (/api/lod/:teamId) -------------------------------------------

    @Route(trajectoryRoutes.lodOctreeMetadata)
    async lodGetOctreeMetadata(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getOctreeMetadataStream(this.params(req));
        await this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    }
}
