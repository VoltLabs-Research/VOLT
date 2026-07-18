import { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import { authenticateOptional, AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import TrajectoryControllerBase from '@modules/trajectory/controllers/TrajectoryControllerBase';
import {
    sendTrajectoryPreview,
    sendTrajectoryPreviewError
} from '@modules/trajectory/controllers/trajectory-preview-response';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

@Middleware(authenticateOptional)
export default class CanvasController extends TrajectoryControllerBase {
    @Route(trajectoryRoutes.canvasBootstrap)
    async canvasBootstrap(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasBootstrap(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasTrajectory)
    async canvasTrajectory(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasTrajectory(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasPreview)
    async canvasPreview(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        try {
            const value = await this.service.getPublicCanvasPreview(this.params(req, this.withOptionalUserId));
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
    async canvasAnalyses(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.listPublicCanvasAnalyses(this.params(req, this.withOptionalUserId)));
    }

    @Route(trajectoryRoutes.canvasDump)
    async canvasDump(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getPublicCanvasDump(this.params(req, this.withOptionalUserId));
        await output.prepare?.();
        await this.pipeStream(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.canvasGlb)
    async canvasGlb(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getPublicCanvasGLB(this.params(req, this.withGlbRequestContext));

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

        await this.pipeStream(res, output.stream, headers);
    }

    @Route(trajectoryRoutes.canvasRasterFrame)
    @Route(trajectoryRoutes.canvasRasterFrameModel)
    async canvasRasterFrame(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getPublicCanvasRasterFrame(this.params(req, this.withOptionalUserId));
        await output.prepare?.();
        await this.pipeStream(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.canvasAtoms)
    async canvasAtomsBinary(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        if (!this.validateAtomsRequest(req, res)) {
            return;
        }

        const input = {
            ...this.buildAtomsInput(req),
            userId: req.authType === AuthenticationType.User ? req.userId : undefined
        };
        const value = await this.service.getPublicCanvasAtoms(input);
        this.sendAtomsBinary(res, value);
    }

    @Route(trajectoryRoutes.canvasSimulationCell)
    async canvasSimulationCell(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasSimulationCell(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasSceneArtifacts)
    async canvasSceneArtifacts(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.listPublicCanvasSceneArtifacts(this.params(req, this.withOptionalUserId)));
    }

    @Route(trajectoryRoutes.canvasColorCodingProperties)
    @Route(trajectoryRoutes.canvasColorCodingPropertiesByAnalysis)
    async canvasColorCodingProperties(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasColorCodingProperties(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasColorCodingStats)
    @Route(trajectoryRoutes.canvasColorCodingStatsByAnalysis)
    async canvasColorCodingStats(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasColorCodingStats(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasColorCodingModel)
    @Route(trajectoryRoutes.canvasColorCodingModelByAnalysis)
    async canvasColorCodingModel(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getPublicCanvasColoredModelStream(this.params(req, this.withOptionalUserId));
        await this.pipeStream(res, output.stream, this.passthroughModelHeaders(output));
    }

    @Route(trajectoryRoutes.canvasParticleFilterProperties)
    @Route(trajectoryRoutes.canvasParticleFilterPropertiesByAnalysis)
    async canvasParticleFilterProperties(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasParticleFilterProperties(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasParticleFilterUniqueValues)
    @Route(trajectoryRoutes.canvasParticleFilterUniqueValuesByAnalysis)
    async canvasParticleFilterUniqueValues(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasParticleFilterUniqueValues(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasParticleFilterPreview)
    @Route(trajectoryRoutes.canvasParticleFilterPreviewByAnalysis)
    async canvasParticleFilterPreview(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasParticleFilterPreview(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasParticleFilterModel)
    @Route(trajectoryRoutes.canvasParticleFilterModelByAnalysis)
    async canvasParticleFilterModel(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getPublicCanvasFilteredModelStream(this.params(req, this.withOptionalUserId));
        await this.pipeStream(res, output.stream, this.passthroughModelHeaders(output));
    }

    @Route(trajectoryRoutes.canvasPlugin)
    async canvasPlugin(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasPlugin(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasPluginListing)
    async canvasPluginListing(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.getPublicCanvasPluginListing(this.params(req, this.withOptionalUserId)));
    }

    @Route(trajectoryRoutes.canvasSubListing)
    async canvasSubListing(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasSubListing(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasExposureGlb)
    async canvasExposureGlb(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const output = await this.service.getPublicCanvasPluginExposureGLB(this.params(req, this.withGlbRequestContext));
        await output.prepare?.();
        await this.pipeStream(res, output.stream, output.headers);
    }

    @Route(trajectoryRoutes.canvasFrameLog)
    async canvasFrameLog(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasAnalysisFrameLog(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(trajectoryRoutes.canvasRasterMetadata)
    async canvasRasterMetadata(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const value = await this.service.getPublicCanvasRasterMetadata(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
