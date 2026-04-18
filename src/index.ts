const { createContainer, InjectionMode, asValue } = require('awilix');
const { DaemonLifecycle } = require('@/app/DaemonLifecycle');
const { registerAnalysisBootstrap } = require('@/app/bootstrap/analysis');
const { registerContainerBootstrap } = require('@/app/bootstrap/container');
const { registerCoreBootstrap } = require('@/app/bootstrap/core');
const { registerJobsBootstrap } = require('@/app/bootstrap/jobs');
const { registerLifecycleBootstrap } = require('@/app/bootstrap/lifecycle');
const { registerNotebookBootstrap } = require('@/app/bootstrap/notebook');
const { registerPluginBootstrap } = require('@/app/bootstrap/plugin');
const { registerRuntimeControlPlaneBootstrap } = require('@/app/bootstrap/runtime-control-plane');
const { registerTrajectoryBootstrap } = require('@/app/bootstrap/trajectory');
const { logger } = require('@/core/logger');

const bootstrap = async () => {
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

    const daemonLifecycle = container.resolve('daemonLifecycle');
    let shutdownPromise = null;

    const handleShutdown = () => {
        shutdownPromise ??= daemonLifecycle.stop();

        shutdownPromise
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    await daemonLifecycle.start();
};

bootstrap().catch((error) => {
    logger.error(`Failed to start cluster daemon: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
