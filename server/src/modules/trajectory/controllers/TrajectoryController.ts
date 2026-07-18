import type TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { presentTeamMetrics } from '@modules/trajectory/presenters/trajectory';
import {
    sendTrajectoryPreview,
    sendTrajectoryPreviewError
} from '@modules/trajectory/controllers/trajectory-preview-response';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { encodeAtomsBinary } from '@modules/trajectory/utilities/atoms/encode-atoms-binary';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

import type { GetAtomsColumnarInputDTO, GetAtomsColumnarOutputDTO } from '@modules/trajectory/dtos/trajectory/GetAtomsDTO';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

const getParamValue = (value: string | string[] | undefined): string => (
    (Array.isArray(value) ? value[0] : value) as string
);

const getOptionalNumber = (value: unknown): number | undefined => (
    value ? Number(value) : undefined
);

const readAcceptEncoding = (req: AuthenticatedRequest): string | undefined => {
    const header = req.headers['accept-encoding'];

    if (Array.isArray(header)) {
        return header.join(',');
    }

    return header;
};

/**
 * The single HTTP controller for the trajectory module. One Express handler per
 * route across every trajectory sub-router (trajectory, canvas, color-coding,
 * particle-filter, line-style, lod, discover), assembling the use-case input
 * exactly as the generated controllers did via `buildControllerParams` (with the
 * same `extendParams` merges), delegating to {@link TrajectoryService}, and
 * responding via {@link BaseResponse} / stream-pipe.
 *
 * Behaviour is preserved byte-for-byte: paginated routes reproduce
 * `createPaginatedController`; the download/GLB/model/line/octree routes
 * reproduce `createStreamController` / `createPreparedDownloadStreamController`
 * (default headers, custom headers, prepared `headers` + `prepare()`); the atoms
 * routes reproduce the columnar-binary controller (format/timestep validation
 * plus the `X-Atom-*` headers); the preview routes reproduce the ETag response
 * and the masked-error escape hatch. Handlers are arrow-function properties so
 * `this` stays bound when passed by reference to the routers, and thrown
 * `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding.
 */
@injectable()
export default class TrajectoryController {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryService) private readonly trajectoryService: TrajectoryService
    ) {}

    // --- Internal helpers -------------------------------------------------

    private params<T>(
        req: AuthenticatedRequest,
        extend?: (req: AuthenticatedRequest, params: Record<string, unknown>) => Record<string, unknown>
    ): T {
        return buildControllerParams(req, extend) as unknown as T;
    }

    private withAuthenticatedUserId = (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ): Record<string, unknown> => ({
        ...params,
        userId: req.userId
    });

    private withOptionalUserId = (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ): Record<string, unknown> => ({
        ...params,
        userId: req.authType === AuthenticationType.User ? req.userId : undefined
    });

    private withGlbRequestContext = (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ): Record<string, unknown> => ({
        ...this.withOptionalUserId(req, params),
        acceptEncoding: readAcceptEncoding(req)
    });

    private sendPaginated(res: Response, value: PaginatedResult<unknown>): void {
        BaseResponse.paginated(res, value, value._meta);
    }

    /**
     * Reproduces `BaseStreamController.handleSuccess`: applies the response
     * headers, wires request-close and stream-error handlers, then pipes.
     */
    private pipeStream(res: Response, stream: Readable, headers: Record<string, string>): void {
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            stream.destroy();
        });

        stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        stream.pipe(res);
    }

    /** Default stream headers, matching `BaseStreamController.getHeaders`. */
    private defaultStreamHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        };
    }

    /** GLB/model passthrough headers, matching the former canvas controllers. */
    private passthroughModelHeaders(value: {
        stream?: unknown;
        contentEncoding?: string;
        contentLength?: number;
    }): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        if (value.contentEncoding && value.contentEncoding !== 'identity') {
            headers['X-Volt-Resource-Encoding'] = value.contentEncoding;
        }

        if (typeof value.contentLength === 'number' && value.contentLength > 0) {
            headers['Content-Length'] = String(value.contentLength);
        }

        return headers;
    }

    private validateAtomsRequest(req: AuthenticatedRequest, res: Response): boolean {
        const fmt = typeof req.query.fmt === 'string' ? req.query.fmt : undefined;
        if (fmt !== 'bin') {
            BaseResponse.error(
                res,
                'Unsupported format: expected ?fmt=bin',
                HttpStatus.BadRequest,
                'TRAJECTORY::ATOMS_UNSUPPORTED_FORMAT'
            );
            return false;
        }

        const timestep = Number(req.params.timestep);
        if (!Number.isFinite(timestep) || timestep < 0) {
            BaseResponse.error(
                res,
                'Invalid timestep',
                HttpStatus.BadRequest,
                'TRAJECTORY::INVALID_TIMESTEP'
            );
            return false;
        }

        return true;
    }

    private buildAtomsInput(req: AuthenticatedRequest): GetAtomsColumnarInputDTO {
        return {
            trajectoryId: getParamValue(req.params.trajectoryId),
            timestep: Number(req.params.timestep),
            page: getOptionalNumber(req.query.page),
            limit: getOptionalNumber(req.query.limit),
            analysisId: typeof req.query.analysisId === 'string' ? req.query.analysisId : undefined
        };
    }

    private sendAtomsBinary(res: Response, value: GetAtomsColumnarOutputDTO): void {
        const body = encodeAtomsBinary(value);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', String(body.byteLength));
        res.setHeader('X-Atom-Total', String(value.total));
        res.setHeader('X-Atom-Page', String(value.page));
        res.setHeader('X-Atom-Limit', String(value.limit));
        res.setHeader('X-Atom-Total-Pages', String(value.totalPages));
        res.setHeader('X-Atom-Properties', value.propertyNames.join(','));
        res.status(HttpStatus.OK).end(body);
    }

    // --- Trajectory -------------------------------------------------------

    createUploadSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.createUploadSession(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    commitUploadSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.commitUploadSession(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    cancelUploadSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.trajectoryService.cancelUploadSession(this.params(req, this.withAuthenticatedUserId));
        res.status(HttpStatus.NoContent).send();
    };

    getByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.getByTeamId(this.params(req)));
    };

    cloneTrajectory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.cloneTrajectory(this.params(req, this.withAuthenticatedUserId));
        BaseResponse.success(res, value, HttpStatus.Accepted);
    };

    getMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getTeamMetrics(this.params(req));
        BaseResponse.success(res, presentTeamMetrics(value));
    };

    getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.updateById(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    move = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.move(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.trajectoryService.deleteById(this.params(req));
        res.status(HttpStatus.NoContent).send();
    };

    listSamples = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.listSamples();
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getPreview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const value = await this.trajectoryService.getPreview(this.params(req));
            sendTrajectoryPreview(res, value);
        } catch (error) {
            logger.error(error);
            if (res.headersSent) {
                throw error;
            }
            sendTrajectoryPreviewError(res, error);
        }
    };

    downloadTrajectory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.downloadTrajectory(this.params(req));
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    downloadTrajectoryAnalyses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.downloadTrajectoryAnalyses(this.params(req));
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    downloadSamples = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.downloadSamples(this.params(req));
        this.pipeStream(res, output.stream, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${output.filename}"`
        });
    };

    getAtomsBinary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        if (!this.validateAtomsRequest(req, res)) {
            return;
        }

        const value = await this.trajectoryService.getAtoms(this.buildAtomsInput(req));
        this.sendAtomsBinary(res, value);
    };

    // --- Scene artifacts --------------------------------------------------

    getSceneArtifacts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.getSceneArtifacts(this.params(req)));
    };

    listTeamSceneArtifacts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.listTeamSceneArtifacts(this.params(req)));
    };

    // --- Color coding -----------------------------------------------------

    colorCodingGetProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getColorCodingProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    colorCodingGetStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getColorCodingStats(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    colorCodingCreate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.createColoredModel(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    colorCodingGet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getColoredModelStream(this.params(req));
        this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    };

    // --- Particle filter --------------------------------------------------

    particleFilterGetProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getParticleFilterProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    particleFilterPreview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.previewParticleFilter(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    particleFilterApplyAction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.applyParticleFilterAction(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    particleFilterGet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getFilteredModelStream(this.params(req));
        this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    };

    particleFilterGetUniqueValues = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getParticleFilterUniqueValues(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    // --- Line style -------------------------------------------------------

    lineStyleCreate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.createLineStyledModel(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    lineStyleGet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getLineStyledModelStream(this.params(req));
        this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    };

    lineStyleGetRanges = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getLineModelRangesStream(this.params(req));
        this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    };

    lineStyleGetEntityProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getLineEntityProperties(this.params(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    // --- LOD --------------------------------------------------------------

    lodGetOctreeMetadata = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getOctreeMetadataStream(this.params(req));
        this.pipeStream(res, output.stream, this.defaultStreamHeaders());
    };

    // --- Discover ---------------------------------------------------------

    discoverListPublicTeamTrajectories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.listPublicTeamTrajectories(this.params(req)));
    };

    // --- Public canvas ----------------------------------------------------

    canvasBootstrap = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasBootstrap(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasTrajectory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasTrajectory(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasPreview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const value = await this.trajectoryService.getPublicCanvasPreview(this.params(req, this.withOptionalUserId));
            sendTrajectoryPreview(res, value);
        } catch (error) {
            logger.error(error);
            if (res.headersSent) {
                throw error;
            }
            sendTrajectoryPreviewError(res, error);
        }
    };

    canvasAnalyses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.listPublicCanvasAnalyses(this.params(req, this.withOptionalUserId)));
    };

    canvasDump = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getPublicCanvasDump(this.params(req, this.withOptionalUserId));
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    canvasGlb = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getPublicCanvasGLB(this.params(req, this.withGlbRequestContext));

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

        this.pipeStream(res, output.stream, headers);
    };

    canvasRasterFrame = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getPublicCanvasRasterFrame(this.params(req, this.withOptionalUserId));
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    canvasAtomsBinary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        if (!this.validateAtomsRequest(req, res)) {
            return;
        }

        const input = {
            ...this.buildAtomsInput(req),
            userId: req.authType === AuthenticationType.User ? req.userId : undefined
        };
        const value = await this.trajectoryService.getPublicCanvasAtoms(input);
        this.sendAtomsBinary(res, value);
    };

    canvasSimulationCell = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasSimulationCell(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasSceneArtifacts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.listPublicCanvasSceneArtifacts(this.params(req, this.withOptionalUserId)));
    };

    canvasColorCodingProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasColorCodingProperties(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasColorCodingStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasColorCodingStats(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasColorCodingModel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getPublicCanvasColoredModelStream(this.params(req, this.withOptionalUserId));
        this.pipeStream(res, output.stream, this.passthroughModelHeaders(output));
    };

    canvasParticleFilterProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasParticleFilterProperties(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasParticleFilterUniqueValues = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasParticleFilterUniqueValues(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasParticleFilterPreview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasParticleFilterPreview(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasParticleFilterModel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getPublicCanvasFilteredModelStream(this.params(req, this.withOptionalUserId));
        this.pipeStream(res, output.stream, this.passthroughModelHeaders(output));
    };

    canvasPlugin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasPlugin(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasPluginListing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        this.sendPaginated(res, await this.trajectoryService.getPublicCanvasPluginListing(this.params(req, this.withOptionalUserId)));
    };

    canvasSubListing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasSubListing(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasExposureGlb = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.trajectoryService.getPublicCanvasPluginExposureGLB(this.params(req, this.withGlbRequestContext));
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    canvasFrameLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasAnalysisFrameLog(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    canvasRasterMetadata = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.trajectoryService.getPublicCanvasRasterMetadata(this.params(req, this.withOptionalUserId));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
