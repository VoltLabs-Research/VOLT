import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';

const JUPYTER_START_ERROR_MESSAGE = 'Failed to start Jupyter';

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

export const resolveJupyterUrlWithServerIp = (url: string): string => {
    try {
        const parsedUrl = new URL(url);
        const serverUrl = new URL(import.meta.env.VITE_API_URL);
        parsedUrl.protocol = serverUrl.protocol;
        parsedUrl.hostname = serverUrl.hostname;
        return parsedUrl.toString();
    } catch {
        return url;
    }
};

export const pickActiveNotebook = (notebooks: ScriptingNotebook[], notebookId?: string): ScriptingNotebook | undefined => {
    if (!notebookId) {
        return notebooks[0];
    }

    return notebooks.find((notebook) => notebook._id === notebookId) || notebooks[0];
};

export const getJupyterStartErrorMessage = (error: unknown): string => {
    if (isRecord(error)) {
        const response = error.response;

        if (isRecord(response) && isRecord(response.data) && typeof response.data.message === 'string' && response.data.message.trim().length > 0) {
            return response.data.message;
        }

        if (typeof error.message === 'string' && error.message.trim().length > 0) {
            return error.message;
        }
    }

    return JUPYTER_START_ERROR_MESSAGE;
};
