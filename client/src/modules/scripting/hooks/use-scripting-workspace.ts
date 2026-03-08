import { useState, useMemo, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useCreateScriptingSessionMutation, scriptingNotebooksQuery } from './queries';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
}

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;
const JUPYTER_START_ERROR_MESSAGE = 'Failed to start Jupyter';

const resolveJupyterUrlWithServerIp = (url: string): string => {
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

const pickActiveNotebook = (notebooks: ScriptingNotebook[], notebookId?: string): ScriptingNotebook | undefined => {
    if (!notebookId) {
        return notebooks[0];
    }

    return notebooks.find((notebook) => notebook._id === notebookId) || notebooks[0];
};

const getJupyterStartErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null) {
        const errorRecord = error as Record<string, unknown>;
        const responseData = errorRecord.response as Record<string, unknown> | undefined;
        const responseMessage = responseData?.data as Record<string, unknown> | undefined;

        if (typeof responseMessage?.message === 'string' && responseMessage.message.trim().length > 0) {
            return responseMessage.message;
        }

        if (typeof errorRecord.message === 'string' && errorRecord.message.trim().length > 0) {
            return errorRecord.message;
        }
    }

    return JUPYTER_START_ERROR_MESSAGE;
};

const useScriptingWorkspace = ({ trajectoryId, notebookId }: UseScriptingWorkspaceInput) => {
    const [jupyterUrl, setJupyterUrl] = useState<string | null>(null);
    const [jupyterError, setJupyterError] = useState<string | null>(null);
    const [startAttempt, setStartAttempt] = useState(0);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();
    const hasAutoStartedRef = useRef(false);

    const notebooksQuery = scriptingNotebooksQuery(
        {
            trajectoryId,
            page: 1,
            limit: WORKSPACE_NOTEBOOKS_FETCH_LIMIT
        },
        { enabled: !!trajectoryId }
    );

    useEffect(() => {
        if (!notebooksQuery.error) return;
        if (!checkRBACError(notebooksQuery.error)) {
            sileo.error({ title: 'Failed to load notebooks' });
        }
    }, [notebooksQuery.error]);

    const notebooks = notebooksQuery.data?.data || [];
    const activeNotebook = useMemo(
        () => pickActiveNotebook(notebooks, notebookId),
        [notebooks, notebookId]
    );

    const scriptingSessionMutation = useCreateScriptingSessionMutation();

    const startJupyterSession = async () => {
        if (!trajectoryId) {
            return;
        }

        setJupyterUrl(null);
        setJupyterError(null);

        sileo.info({ title: 'Starting Jupyter session...' });

        try {
            const session = await scriptingSessionMutation.mutateAsync({
                trajectoryId,
                notebookId: activeNotebook?._id
            });

            if (session.jupyter.ready) {
                setJupyterUrl(resolveJupyterUrlWithServerIp(session.jupyter.url));
                sileo.success({ title: 'Jupyter session ready' });
            } else {
                setJupyterError('Jupyter is still starting. Please retry in a moment.');
                sileo.error({
                    title: 'Jupyter is still starting',
                    description: 'Please retry in a moment.'
                });
            }
        } catch (error: unknown) {
            if (!checkRBACError(error)) {
                setJupyterError(getJupyterStartErrorMessage(error));
                sileo.error({ title: 'Failed to start Jupyter session' });
            }
        }
    };

    useEffect(() => {
        if (!trajectoryId || notebooksQuery.isLoading) {
            return;
        }

        if (hasAutoStartedRef.current && startAttempt === 0) {
            return;
        }

        hasAutoStartedRef.current = true;
        startJupyterSession();
    }, [trajectoryId, activeNotebook?._id, startAttempt, notebooksQuery.isLoading]);

    const retryStartJupyter = () => {
        if (!trajectoryId || scriptingSessionMutation.isPending) {
            return;
        }

        setStartAttempt((value) => value + 1);
    };

    return {
        isLoading: notebooksQuery.isLoading,
        activeNotebook,
        isStartingJupyter: scriptingSessionMutation.isPending,
        error: jupyterError,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
