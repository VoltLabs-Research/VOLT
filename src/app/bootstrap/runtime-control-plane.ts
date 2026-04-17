import { asFunction, createContainer } from 'awilix';
import { QueueConcurrencyCoordinator } from '@/app/coordination/QueueConcurrencyCoordinator';
import { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerRuntimeControlPlaneBootstrap = (
    container: BootstrapContainer
): void => {
    container.register({
        queueConcurrencyCoordinator: asFunction((analysisWorker, trajectoryRasterWorkerService, trajectoryGlbWorkerService, sshImportWorkerService) => {
            return new QueueConcurrencyCoordinator({
                analysisWorker,
                trajectoryRasterWorkerService,
                trajectoryGlbWorkerService,
                sshImportWorkerService
            });
        }).singleton(),
        runtimeRoleCoordinator: asFunction((queueConcurrencyCoordinator, queueScopeLimitsRegistry, analysisWorker, artifactUploadWorkerService, trajectoryRasterWorkerService, trajectoryGlbWorkerService, sshImportWorkerService) => {
            return new RuntimeRoleCoordinator(
                queueConcurrencyCoordinator,
                queueScopeLimitsRegistry,
                {
                    analysisWorker,
                    artifactUploadWorkerService,
                    trajectoryRasterWorkerService,
                    trajectoryGlbWorkerService,
                    sshImportWorkerService
                }
            );
        }).singleton()
    });
};
