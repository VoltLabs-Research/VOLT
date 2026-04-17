import { asValue, createContainer, InjectionMode } from 'awilix';
import { DaemonLifecycle } from '@/app/DaemonLifecycle';
import { registerAnalysisBootstrap } from '@/app/bootstrap/analysis';
import { registerContainerBootstrap } from '@/app/bootstrap/container';
import { registerCoreBootstrap } from '@/app/bootstrap/core';
import { registerJobsBootstrap } from '@/app/bootstrap/jobs';
import { registerLifecycleBootstrap } from '@/app/bootstrap/lifecycle';
import { registerNotebookBootstrap } from '@/app/bootstrap/notebook';
import { registerPluginBootstrap } from '@/app/bootstrap/plugin';
import { registerRuntimeControlPlaneBootstrap } from '@/app/bootstrap/runtime-control-plane';
import { registerTrajectoryBootstrap } from '@/app/bootstrap/trajectory';

export const bootstrap = async (): Promise<void> => {
    const container = createContainer({
        injectionMode: InjectionMode.CLASSIC
    });

    container.register({
        container: asValue(container)
    });

    registerCoreBootstrap(container);
    registerPluginBootstrap(container);
    registerTrajectoryBootstrap(container);
    registerNotebookBootstrap(container);
    registerJobsBootstrap(container);
    registerAnalysisBootstrap(container);
    registerRuntimeControlPlaneBootstrap(container);
    registerContainerBootstrap(container);
    registerLifecycleBootstrap(container);

    const daemonLifecycle = container.resolve<DaemonLifecycle>('daemonLifecycle');
    let shutdownPromise: Promise<void> | null = null;

    const handleShutdown = (): void => {
        shutdownPromise ??= daemonLifecycle.stop();

        shutdownPromise
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    await daemonLifecycle.start();
};
