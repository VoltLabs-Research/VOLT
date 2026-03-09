import {
    AnalysisStartRequest,
    AnalysisQueueJobPayload,
    NativeTrajectoryAtomsPageRequest,
    NativeTrajectoryColorModelRequest,
    NativeTrajectoryFilterPreviewRequest,
    NativeTrajectoryMetadataRequest,
    NativeTrajectoryParticleFilterModelRequest,
    NativeTrajectoryPreprocessRequest,
    NativeTrajectoryPropertyStatsRequest,
    NativeTrajectoryUniqueValuesRequest,
    ObjectUploadRequest,
    OrchestrationAction,
    PluginSyncRequest,
    TrajectoryPreprocessRequest,
    UninstallRequest
} from '../contracts/http';
import { ProgressStage, RuntimeLifecycleEventType } from '../contracts/events';
import { DaemonConfig } from '../config/env';
import { RuntimeEventBroker } from './RuntimeEventBroker';
import { LocalMinioService } from './LocalMinioService';
import { NativeProcessingService } from './NativeProcessingService';
import { LocalRedisService } from './LocalRedisService';
import { DockerRuntimeService } from './DockerRuntimeService';
import { logger } from './logger';
import fs from 'node:fs/promises';

export class OrchestrationService {
    constructor(
        private readonly config: DaemonConfig,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly redisService: LocalRedisService,
        private readonly minioService: LocalMinioService,
        private readonly nativeProcessingService: NativeProcessingService,
        private readonly dockerRuntimeService: DockerRuntimeService,
        private readonly reportLifecycle: (type: RuntimeLifecycleEventType, details?: string) => Promise<void>
    ) {
    }

    async startAnalysis(input: AnalysisStartRequest): Promise<void> {
        this.emitProgress(OrchestrationAction.AnalysisStart, ProgressStage.Accepted, {
            analysisId: input.analysisId
        });

        for (const job of input.payload.jobs) {
            await this.redisService.enqueue('analysis_processing', {
                ...this.toQueuePayload(job),
                executionData: input.executionData
            });
        }

        this.emitProgress(OrchestrationAction.AnalysisStart, ProgressStage.Queued, {
            analysisId: input.analysisId
        });
    }

    async preprocessTrajectory(input: TrajectoryPreprocessRequest): Promise<void> {
        this.emitProgress(OrchestrationAction.TrajectoryPreprocess, ProgressStage.Accepted, {
            trajectoryId: input.trajectoryId
        });
        await this.redisService.enqueue('TrajectoryProcessingQueue', {
            trajectoryId: input.trajectoryId,
            payload: input.payload,
            queuedAt: new Date().toISOString()
        });
        this.emitProgress(OrchestrationAction.TrajectoryPreprocess, ProgressStage.Queued, {
            trajectoryId: input.trajectoryId
        });
    }

    async preprocessTrajectoryNative(input: NativeTrajectoryPreprocessRequest): Promise<void> {
        this.emitProgress(OrchestrationAction.NativeTrajectoryPreprocess, ProgressStage.Accepted, {
            trajectoryId: input.trajectoryId,
            timestep: input.timestep
        });
        await this.nativeProcessingService.preprocessTrajectory(input);
        this.emitProgress(OrchestrationAction.NativeTrajectoryPreprocess, ProgressStage.Completed, {
            trajectoryId: input.trajectoryId,
            timestep: input.timestep
        });
    }

    async getTrajectoryMetadata(input: NativeTrajectoryMetadataRequest) {
        return this.nativeProcessingService.getTrajectoryMetadata(input);
    }

    async getPropertyStats(input: NativeTrajectoryPropertyStatsRequest) {
        return this.nativeProcessingService.getPropertyStats(input);
    }

    async getUniqueValues(input: NativeTrajectoryUniqueValuesRequest) {
        return this.nativeProcessingService.getUniqueValues(input);
    }

    async getAtomsPage(input: NativeTrajectoryAtomsPageRequest) {
        return this.nativeProcessingService.getAtomsPage(input);
    }

    async previewFilter(input: NativeTrajectoryFilterPreviewRequest) {
        return this.nativeProcessingService.previewFilter(input);
    }

    async exportColoredModel(input: NativeTrajectoryColorModelRequest): Promise<{ objectKey: string; }> {
        this.emitProgress(OrchestrationAction.NativeColorModelExport, ProgressStage.Accepted, {
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            objectKey: input.objectKey
        });
        const response = await this.nativeProcessingService.exportColoredModel(input);
        this.emitProgress(OrchestrationAction.NativeColorModelExport, ProgressStage.Completed, {
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            objectKey: input.objectKey
        });
        return response;
    }

    async exportParticleFilterModel(input: NativeTrajectoryParticleFilterModelRequest): Promise<{ objectKey: string; atomsResult: number; }> {
        this.emitProgress(OrchestrationAction.NativeParticleFilterExport, ProgressStage.Accepted, {
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            objectKey: input.objectKey,
            action: input.action
        });
        const response = await this.nativeProcessingService.exportParticleFilterModel(input);
        this.emitProgress(OrchestrationAction.NativeParticleFilterExport, ProgressStage.Completed, {
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            objectKey: input.objectKey,
            action: input.action
        });
        return response;
    }

    async uploadObject(input: ObjectUploadRequest): Promise<void> {
        const encoding = input.encoding || 'utf8';
        await this.minioService.putObject({
            bucket: input.bucket,
            objectKey: input.objectKey,
            body: Buffer.from(input.content, encoding),
            metadata: input.metadata
        });
        this.emitProgress(OrchestrationAction.ObjectUpload, ProgressStage.Completed, {
            bucket: input.bucket,
            objectKey: input.objectKey
        });
    }

    async syncPluginBinary(input: PluginSyncRequest): Promise<{ synced: boolean; objectKey: string; }> {
        try {
            await this.minioService.statObject('volt-plugins', input.objectKey);
        } catch {
            return {
                synced: false,
                objectKey: input.objectKey
            };
        }

        this.emitProgress(OrchestrationAction.PluginSync, ProgressStage.Completed, {
            pluginId: input.pluginId,
            objectKey: input.objectKey
        });

        return {
            synced: true,
            objectKey: input.objectKey
        };
    }

    async uninstall(input: UninstallRequest): Promise<void> {
        await this.reportLifecycle(RuntimeLifecycleEventType.UninstallRequested, input.reason || 'Remote uninstall requested');

        setTimeout(async () => {
            try {
                if (this.config.composeProjectName) {
                    await this.dockerRuntimeService.removeComposeProject(this.config.composeProjectName);
                }

                if (this.config.installRoot) {
                    const installDirectory = `${this.config.installRoot}/${this.config.teamClusterId}`;
                    await fs.rm(installDirectory, {
                        recursive: true,
                        force: true
                    });
                }

                await this.reportLifecycle(RuntimeLifecycleEventType.UninstallCompleted, 'Team cluster cleanup completed');
                process.exit(0);
            } catch (error: unknown) {
                const details = error instanceof Error ? error.message : String(error);
                logger.error({ err: error }, 'Failed to uninstall team cluster runtime');
                await this.reportLifecycle(RuntimeLifecycleEventType.UninstallFailed, details);
            }
        }, 250);
    }

    private emitProgress(action: OrchestrationAction, stage: ProgressStage, payload?: Record<string, unknown>): void {
        this.eventBroker.emitProgress({
            action,
            stage,
            payload,
            timestamp: new Date().toISOString()
        });
    }

    private toQueuePayload(job: AnalysisQueueJobPayload): Record<string, unknown> {
        return {
            ...job
        };
    }
}
