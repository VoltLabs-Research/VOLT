import { createPluginListingRepository, type PluginListingRepository } from './repositories';
import { createExportNodeProcessorService, type ExportNodeProcessorService, type ResultProcessorService, createResultProcessorService } from './services';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { DaemonArtifactReporterService } from '@/modules/cloud-control/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

export interface ArtifactsModule {
    pluginListingRepository: PluginListingRepository;
    exportNodeProcessorService: ExportNodeProcessorService;
    resultProcessorService: ResultProcessorService;
}

export const createArtifactsModule = (
    objectStore: ClusterObjectStore,
    localOwnerClusterId: string,
    nativeModuleLoader: NativeModuleLoader,
    daemonArtifactReporterService: DaemonArtifactReporterService,
    pluginListingRepository: PluginListingRepository = createPluginListingRepository(objectStore, localOwnerClusterId)
): ArtifactsModule => {
    const exportNodeProcessorService = createExportNodeProcessorService(
        objectStore,
        nativeModuleLoader,
        daemonArtifactReporterService
    );
    const resultProcessorService = createResultProcessorService(
        objectStore,
        pluginListingRepository,
        exportNodeProcessorService
    );

    return {
        pluginListingRepository,
        exportNodeProcessorService,
        resultProcessorService
    };
};

export type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from './repositories';
export { createPluginListingRepository } from './repositories';
