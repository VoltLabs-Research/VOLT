import { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import { authenticateOptional } from '@modules/auth/controllers/middleware/authentication';
import { AuthenticationType } from '@shared/contracts/types/AuthenticatedRequest';
import TrajectoryControllerBase from '@modules/trajectory/controllers/TrajectoryControllerBase';
import PublicCanvasService from '@modules/trajectory/services/PublicCanvasService';
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

@Middleware(authenticateOptional)
export default class CanvasController extends TrajectoryControllerBase {
    #canvas = new PublicCanvasService();

    @Route(trajectoryRoutes.canvasBootstrap)
    async canvasBootstrap(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.bootstrap(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasTrajectory)
    async canvasTrajectory(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.trajectory(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasPreview)
    async canvasPreview(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        try {
            const value = await this.#canvas.preview(this.params(req, this.withOptionalUserId));
            sendTrajectoryPreview(res, value);
        } catch (error) {
            logger.error(error);
            if (res.headersSent) {
                throw error;
            }
            sendTrajectoryPreviewError(res, error);
        }
    }

    @Route(trajectoryRoutes.canvasAnalyses)
    async canvasAnalyses(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.#canvas.listAnalyses(this.params(req, this.withOptionalUserId)));
    }

    @Route(trajectoryRoutes.canvasDump)
    async canvasDump(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#canvas.dump(this.params(req, this.withOptionalUserId));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.canvasGlb)
    async canvasGlb(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#canvas.glb(this.params(req, this.withGlbRequestContext));

        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="${output.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        if (output.contentEncoding && output.contentEncoding !== 'identity') {
            headers['X-Volt-Resource-Encoding'] = output.contentEncoding;
        }

        if (typeof output.size === 'number' && output.size > 0) {
            headers['Content-Length'] = String(output.size);
        }

        await pipeStreamToResponse(res, output.stream, headers);
    }

    @Route(trajectoryRoutes.canvasRasterFrame)
    async canvasRasterFrame(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#canvas.rasterFrame(this.params(req, this.withOptionalUserId));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.canvasAtoms)
    async canvasAtomsBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        if (!this.validateAtomsRequest(req, res)) {
            return;
        }

        const value = await this.#canvas.atoms({
            ...this.buildAtomsInput(req),
            userId: req.authType === AuthenticationType.User ? req.userId : undefined
        });
        this.sendAtomsBinary(res, value);
    }

    @Route(trajectoryRoutes.canvasSimulationCell)
    async canvasSimulationCell(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.simulationCell(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasSceneArtifacts)
    async canvasSceneArtifacts(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.#canvas.listSceneArtifacts(this.params(req, this.withOptionalUserId)));
    }

    @Route(trajectoryRoutes.canvasColorCodingProperties)
    async canvasColorCodingProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.colorCodingProperties(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasColorCodingStats)
    async canvasColorCodingStats(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.colorCodingStats(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasColorCodingModel)
    async canvasColorCodingModel(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#canvas.coloredModelStream(this.params(req, this.withOptionalUserId));
        await pipeStreamToResponse(res, output.stream, this.passthroughModelHeaders(output));
    }

    @Route(trajectoryRoutes.canvasParticleFilterProperties)
    async canvasParticleFilterProperties(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.particleFilterProperties(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasParticleFilterUniqueValues)
    async canvasParticleFilterUniqueValues(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.particleFilterUniqueValues(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasParticleFilterPreview)
    async canvasParticleFilterPreview(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.particleFilterPreview(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasParticleFilterModel)
    async canvasParticleFilterModel(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#canvas.filteredModelStream(this.params(req, this.withOptionalUserId));
        await pipeStreamToResponse(res, output.stream, this.passthroughModelHeaders(output));
    }

    @Route(trajectoryRoutes.canvasPlugin)
    async canvasPlugin(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.plugin(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasPluginListing)
    async canvasPluginListing(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        this.sendPaginated(res, await this.#canvas.pluginListing(this.params(req, this.withOptionalUserId)));
    }

    @Route(trajectoryRoutes.canvasSubListing)
    async canvasSubListing(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.subListing(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasExposureGlb)
    async canvasExposureGlb(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const output = await this.#canvas.pluginExposureGLB(this.params(req, this.withGlbRequestContext));
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.canvasFrameLog)
    async canvasFrameLog(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.analysisFrameLog(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasRasterMetadata)
    async canvasRasterMetadata(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#canvas.rasterMetadata(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
