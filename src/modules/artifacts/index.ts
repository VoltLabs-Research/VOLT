import { createPluginListingRepository, type PluginListingRepository } from './repositories';
import { createExportNodeProcessorService, type ExportNodeProcessorService, type ResultProcessorService, createResultProcessorService } from './services';
import type { MinioService } from '@/modules/platform/services';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { DaemonArtifactReporterService } from '@/modules/cloud-control/services';

export interface ArtifactsModule {
    pluginListingRepository: PluginListingRepository;
    exportNodeProcessorService: ExportNodeProcessorService;
    resultProcessorService: ResultProcessorService;
}

export const createArtifactsModule = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    daemonArtifactReporterService: DaemonArtifactReporterService,
    pluginListingRepository: PluginListingRepository = createPluginListingRepository(minioService)
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

    return {
        pluginListingRepository,
        exportNodeProcessorService,
        resultProcessorService
    };
};

export type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from './repositories';
export { createPluginListingRepository } from './repositories';
