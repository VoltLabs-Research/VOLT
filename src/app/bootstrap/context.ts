import { asValue, createContainer, InjectionMode } from 'awilix';
import { autoImportDecoratedFiles } from '@/app/bootstrap/auto-scan';
import { registerBootstrapValues } from '@/app/bootstrap/values';
import { DaemonLifecycle } from '@/app/coordination/DaemonLifecycle';
import { applyDecoratedServices } from '@/core/decorators/service';

export const bootstrap = async (): Promise<void> => {
    const container = createContainer({
        injectionMode: InjectionMode.CLASSIC
    });

    container.register({
        container: asValue(container)
    });

    await autoImportDecoratedFiles();

    registerBootstrapValues(container);
    applyDecoratedServices(container);

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
