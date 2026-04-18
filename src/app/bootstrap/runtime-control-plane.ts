import { asFunction, createContainer } from 'awilix';
import { QueueConcurrencyCoordinator } from '@/app/coordination/QueueConcurrencyCoordinator';
import { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerRuntimeControlPlaneBootstrap = (
    container: BootstrapContainer
): void => {
    container.register({
        queueConcurrencyCoordinator: asFunction((analysisWorker, trajectoryRasterWorker, trajectoryGlbWorker, sshImportWorker) => {
            return new QueueConcurrencyCoordinator({
                analysisWorker,
                trajectoryRasterWorker,
                trajectoryGlbWorker,
                sshImportWorker
            });
        }).singleton(),
        runtimeRoleCoordinator: asFunction((queueConcurrencyCoordinator, queueScopeLimitsRegistry, analysisWorker, artifactUploadWorker, trajectoryRasterWorker, trajectoryGlbWorker, sshImportWorker) => {
            return new RuntimeRoleCoordinator(
                queueConcurrencyCoordinator,
                queueScopeLimitsRegistry,
                {
                    analysisWorker,
                    artifactUploadWorker,
                    trajectoryRasterWorker,
                    trajectoryGlbWorker,
                    sshImportWorker
                }
            );
        }).singleton()
    });
};
