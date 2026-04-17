import type { IEventBus } from '@/core/events/IEventBus';

const { AnalysisLogChunkReportedEvent }: typeof import('@/modules/analysis/application/events/AnalysisLogChunkReportedEvent') = require('@/modules/analysis/application/events/AnalysisLogChunkReportedEvent');
const { DebugLogChunkReportedEvent }: typeof import('@/modules/analysis/application/events/DebugLogChunkReportedEvent') = require('@/modules/analysis/application/events/DebugLogChunkReportedEvent');
const { AnalysisCompletedEvent }: typeof import('@/modules/analysis/domain/events/AnalysisCompletedEvent') = require('@/modules/analysis/domain/events/AnalysisCompletedEvent');
const { AnalysisFailedEvent }: typeof import('@/modules/analysis/domain/events/AnalysisFailedEvent') = require('@/modules/analysis/domain/events/AnalysisFailedEvent');
const { AnalysisStartedEvent }: typeof import('@/modules/analysis/domain/events/AnalysisStartedEvent') = require('@/modules/analysis/domain/events/AnalysisStartedEvent');
const { ArtifactUploadCompletedEvent }: typeof import('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadCompletedEvent') = require('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadCompletedEvent');
const { ArtifactUploadFailedEvent }: typeof import('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent') = require('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent');
const { ArtifactUploadQueuedEvent }: typeof import('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadQueuedEvent') = require('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadQueuedEvent');
const { ArtifactUploadStartedEvent }: typeof import('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent') = require('@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent');
const { GlbCompletedEvent }: typeof import('@/modules/trajectory/domain/events/glb/GlbCompletedEvent') = require('@/modules/trajectory/domain/events/glb/GlbCompletedEvent');
const { GlbFailedEvent }: typeof import('@/modules/trajectory/domain/events/glb/GlbFailedEvent') = require('@/modules/trajectory/domain/events/glb/GlbFailedEvent');
const { GlbStartedEvent }: typeof import('@/modules/trajectory/domain/events/glb/GlbStartedEvent') = require('@/modules/trajectory/domain/events/glb/GlbStartedEvent');
const { RasterCompletedEvent }: typeof import('@/modules/trajectory/domain/events/raster/RasterCompletedEvent') = require('@/modules/trajectory/domain/events/raster/RasterCompletedEvent');
const { RasterFailedEvent }: typeof import('@/modules/trajectory/domain/events/raster/RasterFailedEvent') = require('@/modules/trajectory/domain/events/raster/RasterFailedEvent');
const { RasterStartedEvent }: typeof import('@/modules/trajectory/domain/events/raster/RasterStartedEvent') = require('@/modules/trajectory/domain/events/raster/RasterStartedEvent');
const { SshImportCompletedEvent }: typeof import('@/modules/trajectory/domain/events/ssh-import/SshImportCompletedEvent') = require('@/modules/trajectory/domain/events/ssh-import/SshImportCompletedEvent');
const { SshImportFailedEvent }: typeof import('@/modules/trajectory/domain/events/ssh-import/SshImportFailedEvent') = require('@/modules/trajectory/domain/events/ssh-import/SshImportFailedEvent');
const { SshImportStartedEvent }: typeof import('@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent') = require('@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent');

export class DaemonJobReporterService {
    constructor(private readonly eventBus: IEventBus) {}

    reportAnalysisStarted = (input: ConstructorParameters<typeof AnalysisStartedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new AnalysisStartedEvent(input));
    };

    reportAnalysisCompleted = (input: ConstructorParameters<typeof AnalysisCompletedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new AnalysisCompletedEvent(input));
    };

    reportAnalysisFailed = (input: ConstructorParameters<typeof AnalysisFailedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new AnalysisFailedEvent(input));
    };

    reportAnalysisLogChunk = (input: ConstructorParameters<typeof AnalysisLogChunkReportedEvent>[0]): Promise<void> => {
        if (input.segments.length === 0) {
            return Promise.resolve();
        }

        return this.eventBus.publish(new AnalysisLogChunkReportedEvent(input));
    };

    reportDebugLogChunk = (input: ConstructorParameters<typeof DebugLogChunkReportedEvent>[0]): Promise<void> => {
        if (input.segments.length === 0) {
            return Promise.resolve();
        }

        return this.eventBus.publish(new DebugLogChunkReportedEvent(input));
    };

    reportRasterStarted = (input: ConstructorParameters<typeof RasterStartedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new RasterStartedEvent(input));
    };

    reportRasterCompleted = (input: ConstructorParameters<typeof RasterCompletedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new RasterCompletedEvent(input));
    };

    reportRasterFailed = (input: ConstructorParameters<typeof RasterFailedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new RasterFailedEvent(input));
    };

    reportGlbStarted = (input: ConstructorParameters<typeof GlbStartedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new GlbStartedEvent(input));
    };

    reportGlbCompleted = (input: ConstructorParameters<typeof GlbCompletedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new GlbCompletedEvent(input));
    };

    reportGlbFailed = (input: ConstructorParameters<typeof GlbFailedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new GlbFailedEvent(input));
    };

    reportSshImportStarted = (input: ConstructorParameters<typeof SshImportStartedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new SshImportStartedEvent(input));
    };

    reportSshImportCompleted = (input: ConstructorParameters<typeof SshImportCompletedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new SshImportCompletedEvent(input));
    };

    reportSshImportFailed = (input: ConstructorParameters<typeof SshImportFailedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new SshImportFailedEvent(input));
    };

    reportArtifactUploadQueued = (input: ConstructorParameters<typeof ArtifactUploadQueuedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new ArtifactUploadQueuedEvent(input));
    };

    reportArtifactUploadStarted = (input: ConstructorParameters<typeof ArtifactUploadStartedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new ArtifactUploadStartedEvent(input));
    };

    reportArtifactUploadCompleted = (input: ConstructorParameters<typeof ArtifactUploadCompletedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new ArtifactUploadCompletedEvent(input));
    };

    reportArtifactUploadFailed = (input: ConstructorParameters<typeof ArtifactUploadFailedEvent>[0]): Promise<void> => {
        return this.eventBus.publish(new ArtifactUploadFailedEvent(input));
    };
}

export const createDaemonJobReporterService = (eventBus: IEventBus): DaemonJobReporterService => {
    return new DaemonJobReporterService(eventBus);
};
