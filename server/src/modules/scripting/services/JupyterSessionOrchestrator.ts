import { JupyterContainerManager } from '@modules/scripting/services/JupyterContainerManager';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import { JupyterServerService } from '@modules/scripting/services/JupyterServerService';
import { inject, injectable } from 'tsyringe';
import type {
    DefaultNotebookTemplateContext,
    IScriptingSessionOrchestrator,
    ScriptingSessionNotebookInput,
    ScriptingSessionStartInput,
    ScriptingSessionStartResult
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';

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
        let notebook: ScriptingSessionNotebookInput = {
            notebookPath: this.notebookService.getDefaultNotebookPath()
        };

        if (input.notebook) {
            notebook = input.notebook;
        }

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

    public async resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        return this.notebookService.resolveDefaultNotebookTemplateContent(context);
    }
};
