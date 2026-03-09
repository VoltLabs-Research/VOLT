import { ErrorCodes } from '@core/constants/error-codes';
import fs from 'node:fs/promises';
import path from 'node:path';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable } from 'tsyringe';
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
    private readonly defaultNotebookPath = 'default-scripting-notebook.ipynb';

    getDefaultNotebookPath(): string {
        return this.defaultNotebookPath;
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
};
