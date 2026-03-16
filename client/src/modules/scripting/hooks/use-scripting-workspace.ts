import service from '../api/service';
import { useCreateScriptingSessionMutation, scriptingNotebooksQuery } from './queries';
import {
    JUPYTER_SESSION_TIMEOUT_MESSAGE,
    normalizeScriptingJupyterUrl,
    startAndWaitForReadyScriptingSession
} from '../utilities/jupyter-session';
import { getNotebookTeamClusterId } from '../utilities/notebooks';
import {
    getJupyterStartErrorMessage,
    pickActiveNotebook
} from '../utilities/workspace';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';
import type { ScriptingSession, NotebookContainerStage } from '../api/entities/scripting-session';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
};

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;

const getSessionNotebookId = (session: ScriptingSession, notebook?: ScriptingNotebook | null): string | undefined => {
    if (typeof session.notebookId === 'string' && session.notebookId.length > 0) {
        return session.notebookId;
    }

    return notebook?._id;
};

const useScriptingWorkspace = ({ trajectoryId, notebookId }: UseScriptingWorkspaceInput) => {
    const [jupyterUrl, setJupyterUrl] = useState<string | null>(null);
    const [jupyterError, setJupyterError] = useState<string | null>(null);
    const [isWaitingForJupyter, setIsWaitingForJupyter] = useState(false);
    const [containerStage, setContainerStage] = useState<NotebookContainerStage | null>(null);
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
        setContainerStage(null);

        sileo.info({ title: 'Starting Jupyter session...' });

        try {
            const isRequestCancelled = (): boolean => {
                return !isMountedRef.current || activeStartRequestRef.current !== requestId;
            };
            const result = await startAndWaitForReadyScriptingSession({
                createSession: async () => {
                    const session = await createScriptingSession({
                        trajectoryId,
                        notebookId: activeNotebook?._id,
                        teamClusterId: getNotebookTeamClusterId(activeNotebook)
                    });
                    if (!isRequestCancelled()) {
                        setContainerStage(session.jupyter.containerStage ?? 'creating');
                    }
                    return session;
                },
                readSession: (session) => {
                    const sessionNotebookId = getSessionNotebookId(session, activeNotebook);
                    if (!sessionNotebookId) {
                        throw new Error('Unable to determine notebook session status because no notebook id was returned.');
                    }

                    return service.readNotebookSessionStatus({ notebookId: sessionNotebookId });
                }
            }, {
                isCancelled: isRequestCancelled,
                onPending: (session) => {
                    if (!isRequestCancelled()) {
                        setContainerStage(session.jupyter.containerStage ?? null);
                    }
                }
            });

            if (isRequestCancelled()) {
                return;
            }

            if (!result.timedOut && result.session.jupyter.ready) {
                setContainerStage('ready');
                setJupyterUrl(normalizeScriptingJupyterUrl(result.session.jupyter.url));
                sileo.success({ title: 'Jupyter session ready' });
                return;
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
        containerStage,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
