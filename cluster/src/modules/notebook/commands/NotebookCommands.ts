import { getJupyterRuntime } from '@modules/notebook/services/JupyterRuntime';
import { getDaemonExposureRegistry } from '@modules/container/services/access/DaemonExposureRegistry';
import type { CreateNotebookSessionRequest } from '@shared/contracts';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import type { JupyterRuntime } from '@modules/notebook/services/JupyterRuntime';
import type { DaemonExposureRegistry } from '@modules/container/services/access/DaemonExposureRegistry';

@CommandGroup('notebook')
export class NotebookCommands {
    constructor(
        private readonly jupyterRuntime: JupyterRuntime,
        private readonly daemonExposureRegistry: DaemonExposureRegistry
    ) {}

    @Command('session.create', { status: 201 })
    async createSession(payload: CreateNotebookSessionRequest) {
        const response = await this.jupyterRuntime.ensureSession(payload);
        await this.daemonExposureRegistry.sync().catch(() => {});
        return response;
    }
}

export const getNotebookCommands = commandGroupFactory(NotebookCommands, () => new NotebookCommands(getJupyterRuntime(), getDaemonExposureRegistry()));
