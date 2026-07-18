import fs from 'node:fs/promises';
import path from 'node:path';
import { mergeScriptingNotebookContents } from '@modules/scripting/utilities/build-scripting-notebook';

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

export class JupyterNotebookService {
    async resolveNotebookTemplateContent(): Promise<Record<string, unknown>> {
        const [defaultTemplateRaw, ovitoTemplateRaw] = await Promise.all([
            this.readTemplate(DEFAULT_NOTEBOOK_TEMPLATE_PATH),
            this.readTemplate(OVITO_NOTEBOOK_TEMPLATE_PATH)
        ]);

        return mergeScriptingNotebookContents(defaultTemplateRaw, ovitoTemplateRaw);
    }

    private async readTemplate(templatePath: string): Promise<string> {
        return fs.readFile(templatePath, 'utf8');
    }
}
