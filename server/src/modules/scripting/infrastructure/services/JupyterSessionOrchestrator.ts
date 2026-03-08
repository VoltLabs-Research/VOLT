import { injectable, inject } from 'tsyringe';
import type {
    IScriptingSessionOrchestrator,
    ScriptingSessionStartInput,
    ScriptingSessionStartResult
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import { JupyterContainerManager } from '@modules/scripting/infrastructure/services/JupyterContainerManager';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { JupyterServerService } from '@modules/scripting/infrastructure/services/JupyterServerService';

@injectable()
export class JupyterSessionOrchestrator implements IScriptingSessionOrchestrator {
    constructor(
        @inject(JupyterContainerManager)
        private readonly containerManager: JupyterContainerManager,

        @inject(JupyterNotebookService)
        private readonly notebookService: JupyterNotebookService,

        @inject(JupyterServerService)
        private readonly serverService: JupyterServerService
    ) {}

    public async startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult> {
        const { teamId, trajectoryId, userId } = input;
        const notebook = input.notebook || {
            notebookPath: this.notebookService.getDefaultNotebookPath()
        };
        const { container, hostPort } = await this.containerManager.ensureContainer(teamId, trajectoryId, userId);

        await this.notebookService.writeNotebookFile(container.containerId, trajectoryId, notebook);

        const isReady = await this.serverService.ensureServer(container.containerId, hostPort);
        return {
            jupyter: {
                url: this.serverService.buildJupyterUrl(hostPort, notebook.notebookPath),
                ready: isReady
            }
        };
    }

    public async deleteSession(trajectoryId: string): Promise<void> {
        await this.containerManager.deleteSession(trajectoryId);
    }

    public async resolveDefaultNotebookTemplateContent(context: { trajectoryId: string }): Promise<string> {
        return this.notebookService.resolveDefaultNotebookTemplateContent(context);
    }
}
