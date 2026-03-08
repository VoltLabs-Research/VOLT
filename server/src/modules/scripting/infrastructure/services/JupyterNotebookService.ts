import { getJupyterRuntimeConfig } from '@modules/scripting/utilities/jupyter-runtime-config';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import fs from 'node:fs/promises';
import path from 'node:path';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IContainerService } from '@modules/container/domain/port/IContainerService';
import type {
    DefaultNotebookTemplateContext,
    ScriptingSessionNotebookInput
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';

const DEFAULT_NOTEBOOK_TEMPLATE_PATH = path.join(
    __dirname,
    'templates',
    'default-scripting-notebook.ipynb'
);

@injectable()
export class JupyterNotebookService {
    private readonly runtime = getJupyterRuntimeConfig();
    private readonly defaultNotebookPath = 'default-scripting-notebook.ipynb';

    constructor(
        @inject(CONTAINER_TOKENS.ContainerService)
        private readonly containerService: IContainerService
    ) {}

    getDefaultNotebookPath(): string {
        return this.defaultNotebookPath;
    }

    async writeNotebookFile(
        containerId: string,
        trajectoryId: string,
        notebook: ScriptingSessionNotebookInput
    ): Promise<void> {
        const absNotebookPath = path.posix.join(this.runtime.notebookRoot, notebook.notebookPath);
        const notebookContent = await this.resolveNotebookRawContent(notebook, { trajectoryId });

        await this.containerService.writeFile(containerId, absNotebookPath, notebookContent);
    }

    async resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        const serverDomain = process.env.SERVER_ENDPOINT;

        if (!serverDomain) {
            throw new ApplicationError(
                ErrorCodes.RESOURCE_LOAD_ERROR,
                'SERVER_ENDPOINT is required to build the default notebook template',
                500
            );
        }

        const templateContent = await fs.readFile(DEFAULT_NOTEBOOK_TEMPLATE_PATH, 'utf8');
        return templateContent
            .replace(/<BASE_URL>/g, serverDomain.replace(/\/+$/g, ''))
            .replace(/<TRAJECTORY_ID>/g, context.trajectoryId);
    }

    private async resolveNotebookRawContent(
        notebook: ScriptingSessionNotebookInput,
        context: DefaultNotebookTemplateContext
    ): Promise<string> {
        if (typeof notebook.content === 'string') {
            return notebook.content;
        }

        if (notebook.content != null) {
            return JSON.stringify(notebook.content, null, 2);
        }

        return this.resolveDefaultNotebookTemplateContent(context);
    }
};
