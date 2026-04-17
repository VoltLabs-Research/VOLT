import { asClass, createContainer } from 'awilix';
import { DaemonLifecycle } from '@/app/DaemonLifecycle';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerLifecycleBootstrap = (container: BootstrapContainer): void => {
    container.register({
        daemonLifecycle: asClass(DaemonLifecycle).singleton()
    });
};
