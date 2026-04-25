import {
    createController,
    createPaginatedController,
    createPreparedDownloadStreamController,
    createStreamController
} from '@shared/infrastructure/http/controllers/createController';
import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import { canvasValidationSchemas } from '@modules/trajectory/infrastructure/http/validation/canvas';
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

const GetPublicCanvasBootstrapController = createController(GetPublicCanvasBootstrapUseCase, {
    validationSchema: canvasValidationSchemas.getBootstrap,
    extendParams: withOptionalUserId
});

const GetPublicCanvasTrajectoryController = createController(GetPublicCanvasTrajectoryUseCase, {
    validationSchema: canvasValidationSchemas.getTrajectory,
    extendParams: withOptionalUserId
});

type GetPublicCanvasPreviewOutput = UseCaseOutput<GetPublicCanvasPreviewUseCase>;

const GetPublicCanvasPreviewController = createController(GetPublicCanvasPreviewUseCase, {
    validationSchema: canvasValidationSchemas.getPreview,
    extendParams: withOptionalUserId,
    handleSuccess: (_req, res, value: GetPublicCanvasPreviewOutput) => {
        sendTrajectoryPreview(res, value);
    },
    handleUnexpectedError: sendTrajectoryPreviewError
});

const GetPublicCanvasRasterFrameController = createPreparedDownloadStreamController(GetPublicCanvasRasterFrameUseCase, {
    validationSchema: canvasValidationSchemas.getFrame,
    extendParams: withOptionalUserId
});

const GetPublicCanvasAnalysisRasterFrameController = createPreparedDownloadStreamController(GetPublicCanvasRasterFrameUseCase, {
    validationSchema: canvasValidationSchemas.getAnalysisFrame,
    extendParams: withOptionalUserId
});

const GetPublicCanvasDumpController = createPreparedDownloadStreamController(GetPublicCanvasDumpUseCase, {
    validationSchema: canvasValidationSchemas.getDump,
    extendParams: withOptionalUserId
});

const GetPublicCanvasGLBController = createStreamController(GetPublicCanvasGLBUseCase, {
    validationSchema: canvasValidationSchemas.getGlb,
    extendParams: withGlbRequestContext,
    getHeaders: (resultValue) => {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Vary': 'Accept-Encoding'
        };

        if (resultValue.contentEncoding && resultValue.contentEncoding !== 'identity') {
            headers['Content-Encoding'] = resultValue.contentEncoding;
        }

        if (resultValue.contentEncoding === 'zstd' && typeof resultValue.size === 'number' && resultValue.size > 0) {
            headers['Content-Length'] = String(resultValue.size);
        }

        return headers;
    }
});

const ListPublicCanvasAnalysesController = createPaginatedController(ListPublicCanvasAnalysesUseCase, {
    validationSchema: canvasValidationSchemas.listAnalyses,
    extendParams: withOptionalUserId
});


const GetPublicCanvasSimulationCellController = createController(GetPublicCanvasSimulationCellUseCase, {
    validationSchema: canvasValidationSchemas.getSimulationCell,
    extendParams: withOptionalUserId
});

const ListPublicCanvasSceneArtifactsController = createPaginatedController(ListPublicCanvasSceneArtifactsUseCase, {
    validationSchema: canvasValidationSchemas.listSceneArtifacts,
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingPropertiesController = createController(GetPublicCanvasColorCodingPropertiesUseCase, {
    validationSchema: canvasValidationSchemas.getColorCodingProperties,
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingPropertiesByAnalysisController = createController(GetPublicCanvasColorCodingPropertiesUseCase, {
    validationSchema: canvasValidationSchemas.getColorCodingPropertiesByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingStatsController = createController(GetPublicCanvasColorCodingStatsUseCase, {
    validationSchema: canvasValidationSchemas.getColorCodingStats,
    extendParams: withOptionalUserId
});

const GetPublicCanvasColorCodingStatsByAnalysisController = createController(GetPublicCanvasColorCodingStatsUseCase, {
    validationSchema: canvasValidationSchemas.getColorCodingStatsByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasColoredModelStreamController = createStreamController(GetPublicCanvasColoredModelStreamUseCase, {
    validationSchema: canvasValidationSchemas.getColorCodingModel,
    extendParams: withOptionalUserId
});

const GetPublicCanvasColoredModelStreamByAnalysisController = createStreamController(GetPublicCanvasColoredModelStreamUseCase, {
    validationSchema: canvasValidationSchemas.getColorCodingModelByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPropertiesController = createController(GetPublicCanvasParticleFilterPropertiesUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterProperties,
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPropertiesByAnalysisController = createController(GetPublicCanvasParticleFilterPropertiesUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterPropertiesByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterUniqueValuesController = createController(GetPublicCanvasParticleFilterUniqueValuesUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterUniqueValues,
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterUniqueValuesByAnalysisController = createController(GetPublicCanvasParticleFilterUniqueValuesUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterUniqueValuesByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPreviewController = createController(GetPublicCanvasParticleFilterPreviewUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterPreview,
    extendParams: withOptionalUserId
});

const GetPublicCanvasParticleFilterPreviewByAnalysisController = createController(GetPublicCanvasParticleFilterPreviewUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterPreviewByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasFilteredModelStreamController = createStreamController(GetPublicCanvasFilteredModelStreamUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterModel,
    extendParams: withOptionalUserId
});

const GetPublicCanvasFilteredModelStreamByAnalysisController = createStreamController(GetPublicCanvasFilteredModelStreamUseCase, {
    validationSchema: canvasValidationSchemas.getParticleFilterModelByAnalysis,
    extendParams: withOptionalUserId
});

const GetPublicCanvasPluginController = createController(GetPublicCanvasPluginUseCase, {
    validationSchema: canvasValidationSchemas.getPlugin,
    extendParams: withOptionalUserId
});

const GetPublicCanvasPluginListingController = createPaginatedController(GetPublicCanvasPluginListingUseCase, {
    validationSchema: canvasValidationSchemas.getListing,
    extendParams: withOptionalUserId
});

const GetPublicCanvasSubListingController = createController(GetPublicCanvasSubListingUseCase, {
    validationSchema: canvasValidationSchemas.getSubListing,
    extendParams: withOptionalUserId
});

const GetPublicCanvasPluginExposureGLBController = createPreparedDownloadStreamController(GetPublicCanvasPluginExposureGLBUseCase, {
    validationSchema: canvasValidationSchemas.getExposureGlb,
    extendParams: withGlbRequestContext
});

const GetPublicCanvasAnalysisFrameLogController = createController(GetPublicCanvasAnalysisFrameLogUseCase, {
    validationSchema: canvasValidationSchemas.getFrameLog,
    extendParams: withOptionalUserId
});

const GetPublicCanvasRasterMetadataController = createController(GetPublicCanvasRasterMetadataUseCase, {
    validationSchema: canvasValidationSchemas.getRasterMetadata,
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
