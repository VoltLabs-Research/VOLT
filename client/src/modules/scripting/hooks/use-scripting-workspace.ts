import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import service from '../api/service';
import { useCreateScriptingSessionMutation, scriptingNotebooksQuery } from './queries';
import { JUPYTER_SESSION_TIMEOUT_MESSAGE } from '../utilities/jupyter-session';
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
const JUPYTER_SESSION_STATUS_POLL_INTERVAL_MS = 2_000;
const JUPYTER_SESSION_STATUS_TIMEOUT_MS = 120_000;

const sleep = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const getTeamClusterId = (notebook?: ScriptingNotebook | null): string | undefined => {
    if (!notebook?.teamCluster) {
        return undefined;
    }

    if (typeof notebook.teamCluster === 'string') {
        return notebook.teamCluster;
    }

    return notebook.teamCluster._id;
};

const getSessionNotebookId = (session: { notebookId?: unknown }, notebook?: ScriptingNotebook | null): string | undefined => {
    if (typeof session.notebookId === 'string' && session.notebookId.length > 0) {
        return session.notebookId;
    }

    return notebook?._id;
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
            const isRequestCancelled = (): boolean => {
                return !isMountedRef.current || activeStartRequestRef.current !== requestId;
            };
            const session = await createScriptingSession({
                trajectoryId,
                notebookId: activeNotebook?._id,
                teamClusterId: getTeamClusterId(activeNotebook)
            });

            if (isRequestCancelled()) {
                return;
            }

            const sessionNotebookId = getSessionNotebookId(session, activeNotebook);
            if (!sessionNotebookId) {
                throw new Error('Unable to determine notebook session status because no notebook id was returned.');
            }

            if (session.jupyter.ready) {
                setJupyterUrl(session.jupyter.url);
                sileo.success({ title: 'Jupyter session ready' });
                return;
            }

            const deadlineMs = Date.now() + JUPYTER_SESSION_STATUS_TIMEOUT_MS;

            while (Date.now() < deadlineMs) {
                if (isRequestCancelled()) {
                    return;
                }

                const status = await service.readNotebookSessionStatus({ notebookId: sessionNotebookId });

                if (isRequestCancelled()) {
                    return;
                }

                if (status.jupyter.ready) {
                    setJupyterUrl(status.jupyter.url ?? session.jupyter.url ?? null);
                    sileo.success({ title: 'Jupyter session ready' });
                    return;
                }

                const remainingTimeMs = deadlineMs - Date.now();
                if (remainingTimeMs <= 0) {
                    break;
                }

                await sleep(Math.min(JUPYTER_SESSION_STATUS_POLL_INTERVAL_MS, remainingTimeMs));
            }

            setJupyterError(JUPYTER_SESSION_TIMEOUT_MESSAGE);
            sileo.error({
                title: 'Jupyter is still starting',
                description: JUPYTER_SESSION_TIMEOUT_MESSAGE
            });
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
