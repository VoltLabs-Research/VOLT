import { createPluginListingRepository, type PluginListingRepository } from './repositories';
import {
    ArtifactUploadWorkerService,
    createArtifactUploadQueueService,
    createExportNodeProcessorService,
    type ArtifactUploadQueueService,
    type ExportNodeProcessorService,
    type ResultProcessorService,
    createResultProcessorService
} from './services';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { DaemonArtifactReporterService, DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { QueueService } from '@/modules/platform/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

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
    pluginListingRepository: PluginListingRepository = createPluginListingRepository(objectStore, localOwnerClusterId)
): ArtifactsModule => {
    const artifactUploadQueueService = createArtifactUploadQueueService(queueService);
    const artifactUploadWorkerService = new ArtifactUploadWorkerService(
        queueService,
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
