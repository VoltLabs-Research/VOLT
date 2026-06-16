import type { CreateNotebookSessionRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { JupyterRuntime } from '@/modules/notebook/application/runtime/JupyterRuntime';
import type { DaemonExposureRegistry } from '@/modules/container/application/access/DaemonExposureRegistry';

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

