import { pluginListingRepository } from './repositories';
import { createExportNodeProcessorService, type ExportNodeProcessorService, type ResultProcessorService, createResultProcessorService } from './services';
import type { MinioService } from '../platform/services';
import type { NativeModuleLoader } from '../trajectory-native/services';
import type { DaemonArtifactReporterService } from '../cloud-control/services';

export interface ArtifactsModule {
    exportNodeProcessorService: ExportNodeProcessorService;
    resultProcessorService: ResultProcessorService;
}

export const createArtifactsModule = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    daemonArtifactReporterService: DaemonArtifactReporterService
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
        exportNodeProcessorService,
        resultProcessorService
    };
};
