import { useCreateScriptingSessionMutation, scriptingNotebooksQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import {
    JUPYTER_SESSION_TIMEOUT_MESSAGE,
    waitForReadyScriptingSession
} from '../utilities/jupyter-session';
import {
    getJupyterStartErrorMessage,
    pickActiveNotebook
} from '../utilities/workspace';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
};

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;

const getTeamClusterId = (notebook?: ScriptingNotebook | null): string | undefined => {
    if (!notebook?.teamCluster) {
        return undefined;
    }

    if (typeof notebook.teamCluster === 'string') {
        return notebook.teamCluster;
    }

    return notebook.teamCluster._id;
};

const useScriptingWorkspace = ({ trajectoryId, notebookId }: UseScriptingWorkspaceInput) => {
    const [jupyterUrl, setJupyterUrl] = useState<string | null>(null);
    const [jupyterError, setJupyterError] = useState<string | null>(null);
    const [isWaitingForJupyter, setIsWaitingForJupyter] = useState(false);
    const [startAttempt, setStartAttempt] = useState(0);
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const hasAutoStartedRef = useRef(false);
    const isMountedRef = useRef(true);
    const activeStartRequestRef = useRef(0);

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
        if (!checkAccessDeniedError(notebooksQuery.error)) {
            sileo.error({ title: 'Failed to load notebooks' });
        }
    }, [checkAccessDeniedError, notebooksQuery.error]);

    const notebooks = ((notebooksQuery.data as PaginatedResponse<ScriptingNotebook> | undefined)?.data) ?? [];
    const activeNotebook = useMemo(
        () => pickActiveNotebook(notebooks, notebookId),
        [notebooks, notebookId]
    );

    const { mutateAsync: createScriptingSession, isPending: isCreatingJupyterSession } = useCreateScriptingSessionMutation();

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            activeStartRequestRef.current += 1;
        };
    }, []);

    const startJupyterSession = useCallback(async () => {
        if (!trajectoryId) {
            return;
        }

        const requestId = activeStartRequestRef.current + 1;
        activeStartRequestRef.current = requestId;
        setJupyterUrl(null);
        setJupyterError(null);
        setIsWaitingForJupyter(true);

        sileo.info({ title: 'Starting Jupyter session...' });

        try {
            const result = await waitForReadyScriptingSession(() => createScriptingSession({
                trajectoryId,
                notebookId: activeNotebook?._id,
                teamClusterId: getTeamClusterId(activeNotebook)
            }), {
                isCancelled: () => {
                    return !isMountedRef.current || activeStartRequestRef.current !== requestId;
                }
            });

            if (!isMountedRef.current || activeStartRequestRef.current !== requestId) {
                return;
            }

            if (result.session?.jupyter.ready) {
                setJupyterUrl(result.session.jupyter.url);
                sileo.success({ title: 'Jupyter session ready' });
                return;
            }

            if (result.timedOut) {
                setJupyterError(JUPYTER_SESSION_TIMEOUT_MESSAGE);
                sileo.error({
                    title: 'Jupyter is still starting',
                    description: JUPYTER_SESSION_TIMEOUT_MESSAGE
                });
            }
        } catch (error: unknown) {
            if (!isMountedRef.current || activeStartRequestRef.current !== requestId) {
                return;
            }

            if (!checkAccessDeniedError(error)) {
                setJupyterError(getJupyterStartErrorMessage(error));
                sileo.error({ title: 'Failed to start Jupyter session' });
            }
        } finally {
            if (isMountedRef.current && activeStartRequestRef.current === requestId) {
                setIsWaitingForJupyter(false);
            }
        }
    }, [activeNotebook, checkAccessDeniedError, createScriptingSession, trajectoryId]);

    useEffect(() => {
        if (!trajectoryId || notebooksQuery.isLoading) {
            return;
        }

        if (hasAutoStartedRef.current && startAttempt === 0) {
            return;
        }

        hasAutoStartedRef.current = true;
        startJupyterSession();
    }, [trajectoryId, startAttempt, notebooksQuery.isLoading, startJupyterSession]);

    const retryStartJupyter = () => {
        if (!trajectoryId || isWaitingForJupyter || isCreatingJupyterSession) {
            return;
        }

        setStartAttempt((value) => value + 1);
    };

    return {
        isLoading: notebooksQuery.isLoading,
        activeNotebook,
        isStartingJupyter: isWaitingForJupyter || isCreatingJupyterSession,
        error: jupyterError,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
