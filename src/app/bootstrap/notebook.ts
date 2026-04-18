import { asClass, createContainer } from 'awilix';
import { JupyterRuntime } from '@/modules/notebook/application/runtime/JupyterRuntime';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerNotebookBootstrap = (container: BootstrapContainer): void => {
    container.register({
        jupyterRuntime: asClass(JupyterRuntime).singleton()
    });
};
