import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import fs from 'node:fs/promises';
import path from 'node:path';

interface ScriptingNotebookTemplateDocument extends Record<string, unknown> {
    cells: Record<string, unknown>[];
    nbformat?: number;
    nbformat_minor?: number;
}

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

        return this.mergeScriptingNotebookContents(defaultTemplateRaw, ovitoTemplateRaw);
    }

    private mergeScriptingNotebookContents(...templateRaws: string[]): ScriptingNotebookTemplateDocument {
        if (!templateRaws.length) {
            throw new ApplicationError(
                ErrorCodes.RESOURCE_LOAD_ERROR,
                'At least one notebook template is required',
                500
            );
        }

        const [baseNotebook, ...additionalNotebooks] = templateRaws.map((templateRaw) => {
            return this.parseScriptingNotebookContent(templateRaw);
        });

        for (const notebook of additionalNotebooks) {
            const sameFormat = notebook.nbformat === baseNotebook.nbformat
                && notebook.nbformat_minor === baseNotebook.nbformat_minor;

            if (!sameFormat) {
                throw new ApplicationError(
                    ErrorCodes.RESOURCE_LOAD_ERROR,
                    'Notebook templates must share the same format version',
                    500
                );
            }
        }

        return {
            ...baseNotebook,
            cells: [
                ...baseNotebook.cells,
                ...additionalNotebooks.flatMap((notebook) => notebook.cells)
            ]
        };
    }

    private parseScriptingNotebookContent(templateRaw: string): ScriptingNotebookTemplateDocument {
        const parsedTemplate: unknown = JSON.parse(templateRaw);

        if (!this.isScriptingNotebookDocument(parsedTemplate)) {
            throw new ApplicationError(
                ErrorCodes.RESOURCE_LOAD_ERROR,
                'Notebook template content must be a valid notebook document',
                500
            );
        }

        return parsedTemplate;
    }

    private isScriptingNotebookContent(value: unknown): value is Record<string, unknown> {
        return !!value && !Array.isArray(value) && typeof value === 'object';
    }

    private isScriptingNotebookDocument(value: unknown): value is ScriptingNotebookTemplateDocument {
        return this.isScriptingNotebookContent(value)
            && Array.isArray(value.cells)
            && value.cells.every((cell) => this.isScriptingNotebookContent(cell));
    }

    private async readTemplate(templatePath: string): Promise<string> {
        return fs.readFile(templatePath, 'utf8');
    }
}
