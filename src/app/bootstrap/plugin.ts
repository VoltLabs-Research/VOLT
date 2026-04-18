import { asClass, asFunction, createContainer } from 'awilix';
import { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import { ArtifactUploadWorker } from '@/modules/plugin/application/artifacts/ArtifactUploadWorker';
import { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import { createPluginListingRepository } from '@/modules/plugin/infrastructure/repositories/PluginListingRepository';
import { DefaultResultProcessor } from '@/modules/plugin/application/exports/ResultProcessor';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerPluginBootstrap = (container: BootstrapContainer): void => {
    container.register({
        pluginListingRepository: asFunction(createPluginListingRepository).singleton(),
        pluginBinaryCache: asClass(PluginBinaryCache).singleton(),
        artifactUploadQueue: asClass(ArtifactUploadQueue).singleton(),
        resultProcessor: asClass(DefaultResultProcessor).singleton(),
        artifactUploadWorker: asClass(ArtifactUploadWorker).singleton()
    });
};
