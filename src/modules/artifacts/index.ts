import { createPluginListingRepository } from './repositories';
import {
    ArtifactUploadWorkerService,
    createArtifactUploadQueueService,
    createExportNodeProcessorService,
    createResultProcessorService
} from './services';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { DaemonArtifactReporterService, DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { QueueScopeLimitsRegistry, QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import type { PluginListingRepository } from './repositories';
import type { ArtifactUploadQueueService, ExportNodeProcessorService, ResultProcessorService } from './services';

export interface ArtifactsModule {
    pluginListingRepository: PluginListingRepository;
    artifactUploadQueueService: ArtifactUploadQueueService;
    artifactUploadWorkerService: ArtifactUploadWorkerService;
    exportNodeProcessorService: ExportNodeProcessorService;
    resultProcessorService: ResultProcessorService;
}

export const createArtifactsModule = (
    objectStore: ClusterObjectStore,
    localOwnerClusterId: string,
    nativeModuleLoader: NativeModuleLoader,
    daemonArtifactReporterService: DaemonArtifactReporterService,
    daemonJobReporterService: DaemonJobReporterService,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService,
    queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
    pluginListingRepository: PluginListingRepository = createPluginListingRepository(objectStore, localOwnerClusterId)
): ArtifactsModule => {
    const artifactUploadQueueService = createArtifactUploadQueueService(queueService);
    const artifactUploadWorkerService = new ArtifactUploadWorkerService(
        queueService,
        redisConnectionService,
        queueScopeLimitsRegistry,
        objectStore,
        daemonArtifactReporterService,
        daemonJobReporterService
    );
    const exportNodeProcessorService = createExportNodeProcessorService(nativeModuleLoader);
    const resultProcessorService = createResultProcessorService(
        pluginListingRepository,
        exportNodeProcessorService
    );

    return {
        pluginListingRepository,
        artifactUploadQueueService,
        artifactUploadWorkerService,
        exportNodeProcessorService,
        resultProcessorService
    };
};

export type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from './repositories';
export { createPluginListingRepository } from './repositories';
