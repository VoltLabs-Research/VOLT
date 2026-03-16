import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveServerBaseUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { injectable } from 'tsyringe';
import type {
    DefaultNotebookTemplateContext
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';

const DEFAULT_NOTEBOOK_TEMPLATE_PATH = path.join(
    __dirname,
    'templates',
    'default-scripting-notebook.ipynb'
);

@injectable()
export class JupyterNotebookService {
    async resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        const templateContent = await fs.readFile(DEFAULT_NOTEBOOK_TEMPLATE_PATH, 'utf8');
        return templateContent
            .replace(/<BASE_URL>/g, resolveServerBaseUrl())
            .replace(/<TRAJECTORY_ID>/g, context.trajectoryId || '');
    }
};
