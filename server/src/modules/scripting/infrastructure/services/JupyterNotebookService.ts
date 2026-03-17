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

const OVITO_NOTEBOOK_TEMPLATE_PATH = path.join(
    __dirname,
    'templates',
    'ovito-usage-example.ipynb'
);

@injectable()
export class JupyterNotebookService {
    async resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        const raw = await fs.readFile(DEFAULT_NOTEBOOK_TEMPLATE_PATH, 'utf8');
        return this.applyPlaceholders(raw, context);
    }

    async resolveOvitoNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        const raw = await fs.readFile(OVITO_NOTEBOOK_TEMPLATE_PATH, 'utf8');
        return this.applyPlaceholders(raw, context);
    }

    private applyPlaceholders(raw: string, context: DefaultNotebookTemplateContext): string {
        return raw
            .replace(/<BASE_URL>/g, resolveServerBaseUrl())
            .replace(/<TRAJECTORY_ID>/g, context.trajectoryId || '');
    }
};
