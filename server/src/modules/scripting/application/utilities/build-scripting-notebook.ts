import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

export const buildScriptingNotebookPath = (suffix: string): string => {
    return `scripting-notebook-${suffix}.ipynb`;
};

const isScriptingNotebookContent = (value: unknown): value is Record<string, unknown> => {
    return !!value && !Array.isArray(value) && typeof value === 'object';
};

export const parseScriptingNotebookContent = (templateRaw: string): Record<string, unknown> => {
    const parsedTemplate: unknown = JSON.parse(templateRaw);

    if (!isScriptingNotebookContent(parsedTemplate)) {
        throw new ApplicationError(
            ErrorCodes.RESOURCE_LOAD_ERROR,
            'Default notebook template content must be an object',
            500
        );
    }

    return parsedTemplate;
};
