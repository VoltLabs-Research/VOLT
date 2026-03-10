import {
    nativeTrajectoryAtomsPageSchema,
    nativeTrajectoryColorModelSchema,
    nativeTrajectoryFilterPreviewSchema,
    nativeTrajectoryMetadataSchema,
    nativeTrajectoryParticleFilterModelSchema,
    nativeTrajectoryPropertyStatsSchema,
    nativeTrajectoryUniqueValuesSchema
} from '../validation/schemas';
import { emitProgress } from '../../core/runtimeActions';
import { OrchestrationAction } from '../../contracts/http';
import { ProgressStage } from '../../contracts/events';
import { parseValue, sendError, sendSuccess } from '../common';
import express from 'express';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { FilterEvaluatorService } from '../../modules/native/FilterEvaluatorService';
import type { GlbExporterService } from '../../modules/native/GlbExporterService';
import type { TrajectoryParserService } from '../../modules/native/TrajectoryParserService';

export const createNativeRouter = (
    eventBroker: RuntimeEventBroker,
    glbExporterService: GlbExporterService,
    trajectoryParserService: TrajectoryParserService,
    filterEvaluatorService: FilterEvaluatorService
) => {
    const router = express.Router();

    router.post('/api/orchestration/native/trajectory/preprocess', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryMetadataSchema, req.body);
            emitProgress(eventBroker, OrchestrationAction.NativeTrajectoryPreprocess, ProgressStage.Accepted, {
                trajectoryId: requestBody.trajectoryId,
                timestep: requestBody.timestep
            });
            await glbExporterService.preprocessTrajectory(requestBody);
            emitProgress(eventBroker, OrchestrationAction.NativeTrajectoryPreprocess, ProgressStage.Completed, {
                trajectoryId: requestBody.trajectoryId,
                timestep: requestBody.timestep
            });
            sendSuccess(res, { processed: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/metadata', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryMetadataSchema, req.body);
            sendSuccess(res, await trajectoryParserService.getTrajectoryMetadata(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/property-stats', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryPropertyStatsSchema, req.body);
            sendSuccess(res, await trajectoryParserService.getPropertyStats(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/unique-values', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryUniqueValuesSchema, req.body);
            sendSuccess(res, await trajectoryParserService.getUniqueValues(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/atoms', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryAtomsPageSchema, req.body);
            sendSuccess(res, await trajectoryParserService.getAtomsPage(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/filter-preview', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryFilterPreviewSchema, req.body);
            sendSuccess(res, await filterEvaluatorService.previewFilter(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/color-model', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryColorModelSchema, req.body);
            emitProgress(eventBroker, OrchestrationAction.NativeColorModelExport, ProgressStage.Accepted, {
                trajectoryId: requestBody.trajectoryId,
                timestep: requestBody.timestep,
                objectKey: requestBody.objectKey
            });
            const response = await filterEvaluatorService.exportColoredModel(requestBody);
            emitProgress(eventBroker, OrchestrationAction.NativeColorModelExport, ProgressStage.Completed, {
                trajectoryId: requestBody.trajectoryId,
                timestep: requestBody.timestep,
                objectKey: requestBody.objectKey
            });
            sendSuccess(res, response);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/native/trajectory/particle-filter-model', async (req, res) => {
        try {
            const requestBody = parseValue(nativeTrajectoryParticleFilterModelSchema, req.body);
            emitProgress(eventBroker, OrchestrationAction.NativeParticleFilterExport, ProgressStage.Accepted, {
                trajectoryId: requestBody.trajectoryId,
                timestep: requestBody.timestep,
                objectKey: requestBody.objectKey,
                action: requestBody.action
            });
            const response = await filterEvaluatorService.exportParticleFilterModel(requestBody);
            emitProgress(eventBroker, OrchestrationAction.NativeParticleFilterExport, ProgressStage.Completed, {
                trajectoryId: requestBody.trajectoryId,
                timestep: requestBody.timestep,
                objectKey: requestBody.objectKey,
                action: requestBody.action
            });
            sendSuccess(res, response);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    return router;
};
