import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import fs from 'node:fs/promises';
import path from 'node:path';

interface ScriptingNotebookTemplateDocument extends Record<string, unknown> {
    cells: Record<string, unknown>[];
}

const NOTEBOOK_TEMPLATE_PATHS = [
    path.join(__dirname, 'templates', 'default-scripting-notebook.ipynb'),
    path.join(__dirname, 'templates', 'ovito-usage-example.ipynb')
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return !!value && !Array.isArray(value) && typeof value === 'object';
};

const parseNotebookTemplate = (templateRaw: string): ScriptingNotebookTemplateDocument => {
    const parsedTemplate: unknown = JSON.parse(templateRaw);

    if (!isRecord(parsedTemplate) || !Array.isArray(parsedTemplate.cells) || !parsedTemplate.cells.every(isRecord)) {
        throw new ApplicationError(
            ErrorCodes.RESOURCE_LOAD_ERROR,
            'Notebook template content must be a valid notebook document',
            500
        );
    }

    return parsedTemplate as ScriptingNotebookTemplateDocument;
};

export class JupyterNotebookService {
    async resolveNotebookTemplateContent(): Promise<Record<string, unknown>> {
        const templates = await Promise.all(
            NOTEBOOK_TEMPLATE_PATHS.map(async (templatePath) => parseNotebookTemplate(await fs.readFile(templatePath, 'utf8')))
        );
        const [baseNotebook, ...additionalNotebooks] = templates;

        return {
            ...baseNotebook,
            cells: [
                ...baseNotebook.cells,
                ...additionalNotebooks.flatMap((notebook) => notebook.cells)
            ]
        };
    }
}
