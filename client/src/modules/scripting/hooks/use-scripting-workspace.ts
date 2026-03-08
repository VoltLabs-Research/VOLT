import { useCreateScriptingSessionMutation, scriptingNotebooksQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import {
    getJupyterStartErrorMessage,
    pickActiveNotebook,
    resolveJupyterUrlWithServerIp
} from '../utilities/workspace';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
};

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;

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
    }, [checkRBACError, notebooksQuery.error]);

    const notebooks = ((notebooksQuery.data as PaginatedResponse<ScriptingNotebook> | undefined)?.data) ?? [];
    const activeNotebook = useMemo(
        () => pickActiveNotebook(notebooks, notebookId),
        [notebooks, notebookId]
    );

    const { mutateAsync: createScriptingSession, isPending: isStartingJupyter } = useCreateScriptingSessionMutation();

    const startJupyterSession = useCallback(async () => {
        if (!trajectoryId) {
            return;
        }

        setJupyterUrl(null);
        setJupyterError(null);

        sileo.info({ title: 'Starting Jupyter session...' });

        try {
            const session = await createScriptingSession({
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
    }, [activeNotebook?._id, checkRBACError, createScriptingSession, trajectoryId]);

    useEffect(() => {
        if (!trajectoryId || notebooksQuery.isLoading) {
            return;
        }

        if (hasAutoStartedRef.current && startAttempt === 0) {
            return;
        }

        hasAutoStartedRef.current = true;
        void startJupyterSession();
    }, [trajectoryId, startAttempt, notebooksQuery.isLoading, startJupyterSession]);

    const retryStartJupyter = () => {
        if (!trajectoryId || isStartingJupyter) {
            return;
        }

        setStartAttempt((value) => value + 1);
    };

    return {
        isLoading: notebooksQuery.isLoading,
        activeNotebook,
        isStartingJupyter,
        error: jupyterError,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
