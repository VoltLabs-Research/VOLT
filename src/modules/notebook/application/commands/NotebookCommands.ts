import type { CreateNotebookSessionRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { JupyterRuntime } from '@/modules/notebook/application/runtime/JupyterRuntime';

interface NotebookIdentifierPayload {
    notebookId: string;
}

@CommandGroup('notebook')
export class NotebookCommands {
    constructor(private readonly jupyterRuntime: JupyterRuntime) {}

    @Command('delete')
    async deleteNotebook(payload: NotebookIdentifierPayload) {
        return {
            deleted: await this.jupyterRuntime.deleteSession(payload.notebookId)
        };
    }

    @Command('runtime.get')
    async getRuntime(payload: NotebookIdentifierPayload) {
        const runtime = await this.getReadinessGatedRuntimeTarget(payload.notebookId);
        return { runtime };
    }

    @Command('session.create', { status: 201 })
    createSession(payload: CreateNotebookSessionRequest) {
        return this.jupyterRuntime.ensureSession(payload);
    }

    private async getReadinessGatedRuntimeTarget(notebookId: string) {
        const runtimeTarget = await this.jupyterRuntime.getReadyRuntimeTunnelTarget(notebookId);
        if (!runtimeTarget) {
            return null;
        }

        return {
            tunnelTargetHost: runtimeTarget.host,
            tunnelTargetPort: runtimeTarget.port
        };
    }
}
