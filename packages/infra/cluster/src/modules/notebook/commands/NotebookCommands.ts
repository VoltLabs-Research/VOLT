import { errorMessage } from '@shared/utilities/error-message';
import { logger } from '@shared/logger';
import { getJupyterRuntime } from '@modules/notebook/services/JupyterRuntime';
import { getDockerRuntime } from '@shared/runtime/DockerRuntime';
import { getDaemonExposureRegistry } from '@modules/system/services/access/DaemonExposureRegistry';
import { Command, commandGroupFactory } from '@shared/commands/command';
import type { JupyterRuntime } from '@modules/notebook/services/JupyterRuntime';
import type { DaemonExposureRegistry } from '@modules/system/services/access/DaemonExposureRegistry';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type { CreateNotebookSessionRequest } from '@volt/contracts/modules/scripting/daemon';

export class NotebookCommands {
    constructor(
        private readonly jupyterRuntime: JupyterRuntime,
        private readonly daemonExposureRegistry: DaemonExposureRegistry
    ) {}

    @Command(DaemonCommand.NotebookContainerDelete)
    async deleteContainer(payload: { containerId: string }) {
        await getDockerRuntime().deleteContainer(payload.containerId);
        return { deleted: true };
    }

    @Command(DaemonCommand.NotebookSessionCreate, { status: 201 })
    async createSession(payload: CreateNotebookSessionRequest) {
        const response = await this.jupyterRuntime.ensureSession(payload);
        await this.daemonExposureRegistry.sync().catch((error) => {
            logger.warn(`Failed to sync exposures after notebook session create: ${errorMessage(error)}`);
        });
        return response;
    }
}

export const getNotebookCommands = commandGroupFactory(NotebookCommands, () => new NotebookCommands(getJupyterRuntime(), getDaemonExposureRegistry()));
