import fs from 'node:fs/promises';
import path from 'node:path';
import { mergeScriptingNotebookContents } from '@modules/scripting/application/utilities/build-scripting-notebook';
import { resolveServerBaseUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { Singleton } from '@shared/infrastructure/di/decorators';

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

@Singleton()
export class JupyterNotebookService {
    async resolveNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<Record<string, unknown>> {
        const [defaultTemplateRaw, ovitoTemplateRaw] = await Promise.all([
            this.readTemplate(DEFAULT_NOTEBOOK_TEMPLATE_PATH, context),
            this.readTemplate(OVITO_NOTEBOOK_TEMPLATE_PATH, context)
        ]);

        return mergeScriptingNotebookContents(defaultTemplateRaw, ovitoTemplateRaw);
    }

    private applyPlaceholders(raw: string, context: DefaultNotebookTemplateContext): string {
        return raw
            .replace(/<BASE_URL>/g, resolveServerBaseUrl())
            .replace(/<TRAJECTORY_ID>/g, context.trajectoryId || '');
    }

    private async readTemplate(templatePath: string, context: DefaultNotebookTemplateContext): Promise<string> {
        const raw = await fs.readFile(templatePath, 'utf8');
        return this.applyPlaceholders(raw, context);
    }
};
