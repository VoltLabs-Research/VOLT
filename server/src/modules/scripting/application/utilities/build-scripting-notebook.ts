import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

interface ScriptingNotebookDocument extends Record<string, unknown> {
    cells: Record<string, unknown>[];
    nbformat?: number;
    nbformat_minor?: number;
};

export const DEFAULT_SCRIPTING_NOTEBOOK_TITLE = 'Untitled Notebook';

export const buildScriptingNotebookPath = (suffix: string): string => {
    return `scripting-notebook-${suffix}.ipynb`;
};

const isScriptingNotebookContent = (value: unknown): value is Record<string, unknown> => {
    return !!value && !Array.isArray(value) && typeof value === 'object';
};

const isScriptingNotebookDocument = (value: unknown): value is ScriptingNotebookDocument => {
    return isScriptingNotebookContent(value)
        && Array.isArray(value.cells)
        && value.cells.every(isScriptingNotebookContent);
};

export const parseScriptingNotebookContent = (templateRaw: string): ScriptingNotebookDocument => {
    const parsedTemplate: unknown = JSON.parse(templateRaw);

    if (!isScriptingNotebookDocument(parsedTemplate)) {
        throw new ApplicationError(
            ErrorCodes.RESOURCE_LOAD_ERROR,
            'Notebook template content must be a valid notebook document',
            500
        );
    }

    return parsedTemplate;
};

export const mergeScriptingNotebookContents = (...templateRaws: string[]): ScriptingNotebookDocument => {
    if (!templateRaws.length) {
        throw new ApplicationError(
            ErrorCodes.RESOURCE_LOAD_ERROR,
            'At least one notebook template is required',
            500
        );
    }

    const [baseNotebook, ...additionalNotebooks] = templateRaws.map((templateRaw) => {
        return parseScriptingNotebookContent(templateRaw);
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
};
