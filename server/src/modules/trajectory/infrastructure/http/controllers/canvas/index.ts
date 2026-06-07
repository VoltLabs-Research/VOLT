import {
    createController,
    createPaginatedController,
    createPreparedDownloadStreamController,
    createStreamController
} from '@shared/infrastructure/http/controllers/createController';
import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import { GetPublicCanvasDumpUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasDumpUseCase';
import { GetPublicCanvasGLBUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasGLBUseCase';
import { GetPublicCanvasPreviewUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPreviewUseCase';
import { GetPublicCanvasRasterFrameUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasRasterFrameUseCase';
import { GetPublicCanvasTrajectoryUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasTrajectoryUseCase';
import { ListPublicCanvasAnalysesUseCase } from '@modules/trajectory/application/use-cases/canvas/ListPublicCanvasAnalysesUseCase';
import { GetPublicCanvasSimulationCellUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasSimulationCellUseCase';
import { ListPublicCanvasSceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/canvas/ListPublicCanvasSceneArtifactsUseCase';
import { GetPublicCanvasColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColorCodingPropertiesUseCase';
import { GetPublicCanvasColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColorCodingStatsUseCase';
import { GetPublicCanvasColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColoredModelStreamUseCase';
import { GetPublicCanvasParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterPropertiesUseCase';
import { GetPublicCanvasParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterUniqueValuesUseCase';
import { GetPublicCanvasParticleFilterPreviewUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterPreviewUseCase';
import { GetPublicCanvasFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasFilteredModelStreamUseCase';
import { GetPublicCanvasPluginUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginUseCase';
import { GetPublicCanvasPluginListingUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginListingUseCase';
import { GetPublicCanvasSubListingUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasSubListingUseCase';
import { GetPublicCanvasPluginExposureGLBUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginExposureGLBUseCase';
import { GetPublicCanvasAnalysisFrameLogUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasAnalysisFrameLogUseCase';
import { GetPublicCanvasRasterMetadataUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasRasterMetadataUseCase';
import GetPublicCanvasAtomsBinaryController from './GetPublicCanvasAtomsBinaryController';
import {
    sendTrajectoryPreview,
    sendTrajectoryPreviewError
} from '@modules/trajectory/infrastructure/http/controllers/trajectory-preview-response';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { UseCaseOutput } from '@shared/application/IUseCase';

const withOptionalUserId = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...params,
    userId: req.authType === AuthenticationType.User
        ? req.userId
        : undefined
});

const readAcceptEncoding = (req: AuthenticatedRequest): string | undefined => {
    const header = req.headers['accept-encoding'];
    if (Array.isArray(header)) {
        return header.join(',');
    }

    return header;
};

const withGlbRequestContext = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...withOptionalUserId(req, params),
    acceptEncoding: readAcceptEncoding(req)
});

const getPassthroughModelHeaders = (resultValue: {
    stream?: unknown;
    contentEncoding?: string;
    contentLength?: number;
}): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=31536000, immutable'
    };

    if (resultValue.contentEncoding && resultValue.contentEncoding !== 'identity') {
        headers['X-Volt-Resource-Encoding'] = resultValue.contentEncoding;
    }

    if (typeof resultValue.contentLength === 'number' && resultValue.contentLength > 0) {
        headers['Content-Length'] = String(resultValue.contentLength);
    }

    return headers;
};

const GetPublicCanvasBootstrapController = createController(GetPublicCanvasBootstrapUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasTrajectoryController = createController(GetPublicCanvasTrajectoryUseCase, {
    extendParams: withOptionalUserId
});

type GetPublicCanvasPreviewOutput = UseCaseOutput<GetPublicCanvasPreviewUseCase>;

const GetPublicCanvasPreviewController = createController(GetPublicCanvasPreviewUseCase, {
    extendParams: withOptionalUserId,
    handleSuccess: (_req, res, value: GetPublicCanvasPreviewOutput) => {
        sendTrajectoryPreview(res, value);
    },
    handleUnexpectedError: sendTrajectoryPreviewError
});

const GetPublicCanvasRasterFrameController = createPreparedDownloadStreamController(GetPublicCanvasRasterFrameUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasAnalysisRasterFrameController = createPreparedDownloadStreamController(GetPublicCanvasRasterFrameUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasDumpController = createPreparedDownloadStreamController(GetPublicCanvasDumpUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasGLBController = createStreamController(GetPublicCanvasGLBUseCase, {
    extendParams: withGlbRequestContext,
    getHeaders: (resultValue) => {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        if (resultValue.contentEncoding && resultValue.contentEncoding !== 'identity') {
            headers['X-Volt-Resource-Encoding'] = resultValue.contentEncoding;
        }

        if (typeof resultValue.size === 'number' && resultValue.size > 0) {
            headers['Content-Length'] = String(resultValue.size);
        }

        return headers;
    }
});

const ListPublicCanvasAnalysesController = createPaginatedController(ListPublicCanvasAnalysesUseCase, {
    extendParams: withOptionalUserId
});


const GetPublicCanvasSimulationCellController = createController(GetPublicCanvasSimulationCellUseCase, {
    extendParams: withOptionalUserId
});

const ListPublicCanvasSceneArtifactsController = createPaginatedController(ListPublicCanvasSceneArtifactsUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingPropertiesController = createController(GetPublicCanvasColorCodingPropertiesUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingPropertiesByAnalysisController = createController(GetPublicCanvasColorCodingPropertiesUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingStatsController = createController(GetPublicCanvasColorCodingStatsUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingStatsByAnalysisController = createController(GetPublicCanvasColorCodingStatsUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasColoredModelStreamController = createStreamController(GetPublicCanvasColoredModelStreamUseCase, {
    extendParams: withOptionalUserId,
    getHeaders: getPassthroughModelHeaders
});

const GetPublicCanvasColoredModelStreamByAnalysisController = createStreamController(GetPublicCanvasColoredModelStreamUseCase, {
    extendParams: withOptionalUserId,
    getHeaders: getPassthroughModelHeaders
});

const GetPublicCanvasParticleFilterPropertiesController = createController(GetPublicCanvasParticleFilterPropertiesUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPropertiesByAnalysisController = createController(GetPublicCanvasParticleFilterPropertiesUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterUniqueValuesController = createController(GetPublicCanvasParticleFilterUniqueValuesUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterUniqueValuesByAnalysisController = createController(GetPublicCanvasParticleFilterUniqueValuesUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPreviewController = createController(GetPublicCanvasParticleFilterPreviewUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPreviewByAnalysisController = createController(GetPublicCanvasParticleFilterPreviewUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasFilteredModelStreamController = createStreamController(GetPublicCanvasFilteredModelStreamUseCase, {
    extendParams: withOptionalUserId,
    getHeaders: getPassthroughModelHeaders
});

const GetPublicCanvasFilteredModelStreamByAnalysisController = createStreamController(GetPublicCanvasFilteredModelStreamUseCase, {
    extendParams: withOptionalUserId,
    getHeaders: getPassthroughModelHeaders
});

const GetPublicCanvasPluginController = createController(GetPublicCanvasPluginUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasPluginListingController = createPaginatedController(GetPublicCanvasPluginListingUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasSubListingController = createController(GetPublicCanvasSubListingUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasPluginExposureGLBController = createPreparedDownloadStreamController(GetPublicCanvasPluginExposureGLBUseCase, {
    extendParams: withGlbRequestContext
});

const GetPublicCanvasAnalysisFrameLogController = createController(GetPublicCanvasAnalysisFrameLogUseCase, {
    extendParams: withOptionalUserId
});

const GetPublicCanvasRasterMetadataController = createController(GetPublicCanvasRasterMetadataUseCase, {
    extendParams: withOptionalUserId
});

const resolvedControllers = createControllerRegistry({
    bootstrap: GetPublicCanvasBootstrapController,
    trajectory: GetPublicCanvasTrajectoryController,
    preview: GetPublicCanvasPreviewController,
    rasterFrame: GetPublicCanvasRasterFrameController,
    analysisRasterFrame: GetPublicCanvasAnalysisRasterFrameController,
    dump: GetPublicCanvasDumpController,
    glb: GetPublicCanvasGLBController,
    analyses: ListPublicCanvasAnalysesController,
    simulationCell: GetPublicCanvasSimulationCellController,
    sceneArtifacts: ListPublicCanvasSceneArtifactsController,
    colorCodingProperties: GetPublicCanvasColorCodingPropertiesController,
    colorCodingPropertiesByAnalysis: GetPublicCanvasColorCodingPropertiesByAnalysisController,
    colorCodingStats: GetPublicCanvasColorCodingStatsController,
    colorCodingStatsByAnalysis: GetPublicCanvasColorCodingStatsByAnalysisController,
    colorCodingModel: GetPublicCanvasColoredModelStreamController,
    colorCodingModelByAnalysis: GetPublicCanvasColoredModelStreamByAnalysisController,
    particleFilterProperties: GetPublicCanvasParticleFilterPropertiesController,
    particleFilterPropertiesByAnalysis: GetPublicCanvasParticleFilterPropertiesByAnalysisController,
    particleFilterUniqueValues: GetPublicCanvasParticleFilterUniqueValuesController,
    particleFilterUniqueValuesByAnalysis: GetPublicCanvasParticleFilterUniqueValuesByAnalysisController,
    particleFilterPreview: GetPublicCanvasParticleFilterPreviewController,
    particleFilterPreviewByAnalysis: GetPublicCanvasParticleFilterPreviewByAnalysisController,
    particleFilterModel: GetPublicCanvasFilteredModelStreamController,
    particleFilterModelByAnalysis: GetPublicCanvasFilteredModelStreamByAnalysisController,
    plugin: GetPublicCanvasPluginController,
    pluginListing: GetPublicCanvasPluginListingController,
    subListing: GetPublicCanvasSubListingController,
    exposureGlb: GetPublicCanvasPluginExposureGLBController,
    frameLog: GetPublicCanvasAnalysisFrameLogController,
    rasterMetadata: GetPublicCanvasRasterMetadataController,
    atomsBinary: GetPublicCanvasAtomsBinaryController
});

export default resolvedControllers;
