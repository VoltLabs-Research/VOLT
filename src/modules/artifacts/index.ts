import { createPluginListingRepository, type PluginListingRepository } from './repositories';
import {
    AnalysisExposureProcessingDispatchService,
    AnalysisExposureProcessingWorkerService,
    createExportNodeProcessorService,
    type ExportNodeProcessorService,
    type ResultProcessorService,
    createResultProcessorService
} from './services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { DaemonArtifactReporterService } from '@/modules/cloud-control/services';

export interface ArtifactsModule {
    pluginListingRepository: PluginListingRepository;
    exportNodeProcessorService: ExportNodeProcessorService;
    resultProcessorService: ResultProcessorService;
    analysisExposureProcessingDispatchService: AnalysisExposureProcessingDispatchService;
    analysisExposureProcessingWorkerService: AnalysisExposureProcessingWorkerService;
}

export const createArtifactsModule = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService,
    daemonArtifactReporterService: DaemonArtifactReporterService,
    pluginListingRepository: PluginListingRepository = createPluginListingRepository()
): ArtifactsModule => {
    const exportNodeProcessorService = createExportNodeProcessorService(
        minioService,
        nativeModuleLoader,
        daemonArtifactReporterService
    );
    const resultProcessorService = createResultProcessorService(
        minioService,
        pluginListingRepository,
        exportNodeProcessorService
    );
    const analysisExposureProcessingDispatchService = new AnalysisExposureProcessingDispatchService(
        queueService,
        redisConnectionService
    );
    const analysisExposureProcessingWorkerService = new AnalysisExposureProcessingWorkerService(
        queueService,
        redisConnectionService,
        resultProcessorService
    );

    return {
        pluginListingRepository,
        exportNodeProcessorService,
        resultProcessorService,
        analysisExposureProcessingDispatchService,
        analysisExposureProcessingWorkerService
    };
};

export type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from './repositories';
export { createPluginListingRepository } from './repositories';
