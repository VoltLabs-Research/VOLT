import { asClass, createContainer } from 'awilix';
import { JupyterRuntimeService } from '@/modules/notebook/application/runtime/JupyterRuntimeService';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerNotebookBootstrap = (container: BootstrapContainer): void => {
    container.register({
        jupyterRuntimeService: asClass(JupyterRuntimeService).singleton()
    });
};
