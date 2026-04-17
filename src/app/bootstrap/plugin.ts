import { asClass, asFunction, createContainer } from 'awilix';
import { createArtifactUploadQueueService } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';
import { ArtifactUploadWorkerService } from '@/modules/plugin/application/artifacts/ArtifactUploadWorkerService';
import { createExportNodeProcessorService } from '@/modules/plugin/application/exports/ExportNodeProcessorService';
import { createPluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import { createPluginListingRepository } from '@/modules/plugin/infrastructure/repositories/PluginListingRepository';
import { createResultProcessorService } from '@/modules/plugin/application/exports/ResultProcessorService';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerPluginBootstrap = (container: BootstrapContainer): void => {
    container.register({
        pluginListingRepository: asFunction(createPluginListingRepository).singleton(),
        pluginBinaryCacheService: asFunction(createPluginBinaryCacheService).singleton(),
        artifactUploadQueueService: asFunction(createArtifactUploadQueueService).singleton(),
        exportNodeProcessorService: asFunction(createExportNodeProcessorService).singleton(),
        resultProcessorService: asFunction(createResultProcessorService).singleton(),
        artifactUploadWorkerService: asClass(ArtifactUploadWorkerService).singleton()
    });
};
