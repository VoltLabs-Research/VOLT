import service from '../api/scripting-service';
import { useCreateScriptingSessionMutation } from './queries';
import {
    getJupyterStartErrorMessage,
    JUPYTER_SESSION_TIMEOUT_MESSAGE,
    startAndWaitForReadyScriptingSession
} from '../utils/jupyter-session';
import {
    readRememberedJupyterUrl,
    rememberReadyJupyterUrl
} from '../utils/jupyter-ready-url-cache';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { ScriptingNotebook, NotebookContainerStage } from '@volt/contracts/modules/scripting/domain';
import type { ScriptingNotebookDeploymentSelection } from '../components/ScriptingNotebookDeploymentModal';
import type { WaitForReadyScriptingSessionOptions } from '../utils/jupyter-session';

interface UseJupyterSessionInput {
    trajectoryId: string;
    notebookId?: string;
    activeNotebook?: ScriptingNotebook;
    /** False while notebooks are still loading or the user has yet to pick a cluster. */
    canAutoStart: boolean;
    checkAccessDeniedError: (error: unknown) => boolean;
    onNotebookIdChange?: (notebookId: string) => void;
    onNotebookCreated: () => Promise<void>;
};

/** Provisions the Jupyter container for a workspace and tracks its readiness. */
const useJupyterSession = ({
    trajectoryId,
    notebookId,
    activeNotebook,
    canAutoStart,
    checkAccessDeniedError,
    onNotebookIdChange,
    onNotebookCreated
}: UseJupyterSessionInput) => {
    const [jupyterUrl, setJupyterUrl] = useState<string | null>(() => readRememberedJupyterUrl({
        trajectoryId,
        notebookId
    }));
    const [jupyterError, setJupyterError] = useState<string | null>(null);
    const [isWaitingForJupyter, setIsWaitingForJupyter] = useState(false);
    const [containerStage, setContainerStage] = useState<NotebookContainerStage | null>(null);
    const [startAttempt, setStartAttempt] = useState(0);
    const isMountedRef = useRef(true);
    const activeStartRequestRef = useRef(0);
    const lastStartedWorkspaceKeyRef = useRef<string | null>(null);

    const { mutateAsync: createScriptingSession, isPending: isCreatingJupyterSession } = useCreateScriptingSessionMutation();
    const workspaceSessionKey = `${trajectoryId}:${activeNotebook?._id ?? 'shared'}:${startAttempt}`;
    const restartSession = useCallback(() => setStartAttempt((value) => value + 1), []);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            activeStartRequestRef.current += 1;
        };
    }, []);

    useEffect(() => {
        if (jupyterUrl || !trajectoryId) {
            return;
        }

        const rememberedUrl = readRememberedJupyterUrl({
            trajectoryId,
            notebookId: activeNotebook?._id ?? notebookId
        });
        if (!rememberedUrl) {
            return;
        }

        setContainerStage('ready');
        setJupyterUrl(rememberedUrl);
    }, [activeNotebook?._id, jupyterUrl, notebookId, trajectoryId]);

    const startJupyterSession = useCallback(async (deploymentSelection?: ScriptingNotebookDeploymentSelection) => {
        if (!trajectoryId || (!activeNotebook && !deploymentSelection)) {
            return;
        }

        const requestId = activeStartRequestRef.current + 1;
        activeStartRequestRef.current = requestId;
        setJupyterUrl(null);
        setJupyterError(null);
        setIsWaitingForJupyter(true);
        setContainerStage(null);

        const loadingToastId = sileo.show({
            type: 'loading',
            title: 'Starting Jupyter session...',
            description: 'Provisioning the notebook container on the cluster.',
            duration: null
        });

        try {
            const isRequestCancelled = (): boolean => {
                return !isMountedRef.current || activeStartRequestRef.current !== requestId;
            };
            const waitForReadyOptions: WaitForReadyScriptingSessionOptions = {
                isCancelled: isRequestCancelled,
                onPending: (session) => {
                    if (!isRequestCancelled()) {
                        setContainerStage(session.jupyter.containerStage ?? null);
                    }
                }
            };

            if (activeNotebook?._id && !deploymentSelection) {
                const existingSession = await service.readNotebookSessionStatus({ notebookId: activeNotebook._id });
                if (isRequestCancelled()) {
                    sileo.dismiss(loadingToastId);
                    return;
                }

                if (existingSession.jupyter.ready) {
                    sileo.dismiss(loadingToastId);
                    setContainerStage('ready');
                    rememberReadyJupyterUrl({
                        trajectoryId,
                        notebookId: activeNotebook._id
                    }, existingSession.jupyter.url);
                    setJupyterUrl(existingSession.jupyter.url);
                    onNotebookIdChange?.(activeNotebook._id);
                    return;
                }

                setContainerStage(existingSession.jupyter.containerStage ?? null);
            }

            const result = await startAndWaitForReadyScriptingSession({
                createSession: async () => {
                    const session = await createScriptingSession({
                        trajectoryId,
                        notebookId: activeNotebook?._id,
                        teamClusterId: deploymentSelection?.teamClusterId
                    });
                    if (!isRequestCancelled()) {
                        setContainerStage(session.jupyter.containerStage ?? 'creating');
                        onNotebookIdChange?.(session.notebookId);
                    }
                    return session;
                },
                readSession: (session) => service.readNotebookSessionStatus({ notebookId: session.notebookId })
            }, waitForReadyOptions);

            if (isRequestCancelled()) {
                sileo.dismiss(loadingToastId);
                return;
            }

            sileo.dismiss(loadingToastId);
            onNotebookIdChange?.(result.session.notebookId);

            if (!activeNotebook) {
                await onNotebookCreated();
            }

            if (!result.timedOut && result.session.jupyter.ready) {
                setContainerStage('ready');
                rememberReadyJupyterUrl({
                    trajectoryId,
                    notebookId: result.session.notebookId
                }, result.session.jupyter.url);
                setJupyterUrl(result.session.jupyter.url);
                sileo.success({ title: 'Jupyter session ready' });
                return;
            }

            setJupyterError(JUPYTER_SESSION_TIMEOUT_MESSAGE);
            sileo.warning({
                title: 'Jupyter is still starting',
                description: JUPYTER_SESSION_TIMEOUT_MESSAGE,
                duration: 8000,
                button: {
                    title: 'Retry',
                    onClick: restartSession
                }
            });
        } catch (error: unknown) {
            sileo.dismiss(loadingToastId);

            if (!isMountedRef.current || activeStartRequestRef.current !== requestId) {
                return;
            }

            if (!checkAccessDeniedError(error)) {
                setJupyterError(getJupyterStartErrorMessage(error));
                sileo.error({
                    title: 'Failed to start Jupyter session',
                    description: getJupyterStartErrorMessage(error),
                    duration: 8000,
                    button: {
                        title: 'Retry',
                        onClick: restartSession
                    }
                });
            }
        } finally {
            if (isMountedRef.current && activeStartRequestRef.current === requestId) {
                setIsWaitingForJupyter(false);
            }
        }
    }, [activeNotebook, checkAccessDeniedError, createScriptingSession, onNotebookCreated, onNotebookIdChange, restartSession, trajectoryId]);

    useEffect(() => {
        if (!trajectoryId || !canAutoStart || lastStartedWorkspaceKeyRef.current === workspaceSessionKey) {
            return;
        }

        lastStartedWorkspaceKeyRef.current = workspaceSessionKey;
        startJupyterSession();
    }, [canAutoStart, startJupyterSession, trajectoryId, workspaceSessionKey]);

    return {
        jupyterUrl,
        jupyterError,
        containerStage,
        isStartingJupyter: isWaitingForJupyter || isCreatingJupyterSession,
        startJupyterSession,
        restartSession
    };
};

export default useJupyterSession;
