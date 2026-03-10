import type { DaemonConfig } from '@/core/config';
import type { DockerRuntimeService } from '@/modules/platform/services';
import { createNotebookRepository, type NotebookRepository } from './repositories';
import { JupyterRuntimeService } from './services';

export interface JupyterModule {
    notebookRepository: NotebookRepository;
    jupyterRuntimeService: JupyterRuntimeService;
}

export const createJupyterModule = (
    config: DaemonConfig,
    dockerRuntimeService: DockerRuntimeService
): JupyterModule => ({
    notebookRepository: createNotebookRepository(),
    jupyterRuntimeService: new JupyterRuntimeService(config, dockerRuntimeService)
});

export type { NotebookRepository } from './repositories';
export { createNotebookRepository } from './repositories';
export { JupyterRuntimeService } from './services';
