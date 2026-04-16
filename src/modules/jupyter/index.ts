import type { DaemonConfig } from '@/core/config';
import type { DockerRuntimeService } from '@/modules/platform/services';
import { JupyterRuntimeService } from './services';

interface JupyterModule {
    jupyterRuntimeService: JupyterRuntimeService;
};

export const createJupyterModule = (
    config: DaemonConfig,
    dockerRuntimeService: DockerRuntimeService
): JupyterModule => ({
    jupyterRuntimeService: new JupyterRuntimeService(config, dockerRuntimeService)
});

export { JupyterRuntimeService } from './services';
