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

/** Number of leading cells in the OVITO template that overlap with the default
 *  template (title, connect-to-volt header, connect code, load-trajectory
 *  header, load-trajectory code). Everything from index 5 onward is
 *  OVITO-specific (download dumps, pipeline, CNA, strain, etc.). */
const OVITO_CELLS_SKIP_COUNT = 5;

@injectable()
export class JupyterNotebookService {
    async resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        const [defaultRaw, ovitoRaw] = await Promise.all([
            fs.readFile(DEFAULT_NOTEBOOK_TEMPLATE_PATH, 'utf8'),
            fs.readFile(OVITO_NOTEBOOK_TEMPLATE_PATH, 'utf8')
        ]);

        const defaultNotebook = JSON.parse(defaultRaw);
        const ovitoNotebook = JSON.parse(ovitoRaw);

        const separatorCell = {
            cell_type: 'markdown',
            metadata: {},
            source: [
                '---\n',
                '\n',
                '# OVITO Integration\n',
                '\n',
                'The cells below demonstrate how to use **OVITO** with your Volt trajectory data.\n',
                'You can perform structural analysis (CNA, PTM), compute atomic strain,\n',
                'track properties across frames, and combine results with Volt listings.'
            ]
        };

        const ovitoCells = ovitoNotebook.cells.slice(OVITO_CELLS_SKIP_COUNT);
        defaultNotebook.cells = [
            ...defaultNotebook.cells,
            separatorCell,
            ...ovitoCells
        ];

        const merged = JSON.stringify(defaultNotebook, null, 2);
        return merged
            .replace(/<BASE_URL>/g, resolveServerBaseUrl())
            .replace(/<TRAJECTORY_ID>/g, context.trajectoryId || '');
    }
};
