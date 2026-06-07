import service from '../api/scripting-service';
import {
    scriptingNotebooksQueryKey,
    scriptingNotebooksQuery,
    useCreateScriptingSessionMutation,
    useUpdateScriptingNotebookMutation
} from './queries';
import {
    JUPYTER_SESSION_TIMEOUT_MESSAGE,
    startAndWaitForReadyScriptingSession
} from '../utilities/jupyter-session';
import { hasNotebookDeploymentConfiguration } from '../utilities/notebooks';
import {
    getJupyterStartErrorMessage,
    pickActiveNotebook
} from '../utilities/workspace';
import queryClient from '@/shared/infrastructure/query/query-client';
import { SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID } from '../components/ScriptingNotebookDeploymentModal';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { closeModal, openModal } from '@voltstack/bravais';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';
import type { ScriptingSession, NotebookContainerStage } from '../api/entities/scripting-session';
import type {
    ScriptingNotebookDeploymentModalRequest,
    ScriptingNotebookDeploymentSelection
} from '../components/ScriptingNotebookDeploymentModal';
import type { WaitForReadyScriptingSessionOptions, WaitForReadyScriptingSessionResult } from '../utilities/jupyter-session';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
    onNotebookIdChange?: (notebookId: string) => void;
};

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;
const SAVE_NOTEBOOK_DEPLOYMENT_TOAST = {
    loading: { title: 'Saving notebook deployment...' },
    success: { title: 'Notebook deployment saved successfully' },
    error: { title: 'Failed to save notebook deployment' }
};
const readyJupyterUrlByNotebookId = new Map<string, string>();
const readyJupyterUrlByTrajectoryId = new Map<string, string>();

const getSessionNotebookId = (session: ScriptingSession, notebook?: ScriptingNotebook | null): string | undefined => {
    if (typeof session.notebookId === 'string' && session.notebookId.length > 0) {
        return session.notebookId;
    }

    return notebook?._id;
};

const rememberReadyJupyterUrl = (input: { trajectoryId: string; notebookId?: string; url: string }): void => {
    if (!input.url) {
        return;
    }

    if (input.notebookId) {
        readyJupyterUrlByNotebookId.set(input.notebookId, input.url);
    }

    if (input.trajectoryId) {
        readyJupyterUrlByTrajectoryId.set(input.trajectoryId, input.url);
    }
};

const readRememberedJupyterUrl = (input: { trajectoryId: string; notebookId?: string }): string | null => {
    if (input.notebookId) {
        const notebookUrl = readyJupyterUrlByNotebookId.get(input.notebookId);
        if (notebookUrl) {
            return notebookUrl;
        }
    }

    return readyJupyterUrlByTrajectoryId.get(input.trajectoryId) ?? null;
};

const useScriptingWorkspace = ({ trajectoryId, notebookId, onNotebookIdChange }: UseScriptingWorkspaceInput) => {
    const teamId = useSelectedTeamId();
    const [jupyterUrl, setJupyterUrl] = useState<string | null>(() => readRememberedJupyterUrl({ trajectoryId, notebookId }));
    const [jupyterError, setJupyterError] = useState<string | null>(null);
    const [isWaitingForJupyter, setIsWaitingForJupyter] = useState(false);
    const [containerStage, setContainerStage] = useState<NotebookContainerStage | null>(null);
    const [startAttempt, setStartAttempt] = useState(0);
    const [deploymentModalRequest, setDeploymentModalRequest] = useState<ScriptingNotebookDeploymentModalRequest | null>(null);
    const [deploymentRequiredMessage, setDeploymentRequiredMessage] = useState<string | null>(null);
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const isMountedRef = useRef(true);
    const activeStartRequestRef = useRef(0);
    const lastStartedWorkspaceKeyRef = useRef<string | null>(null);
    const lastDeploymentPromptKeyRef = useRef<string | null>(null);

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
    const requiresNotebookCreation = !activeNotebook;
    const requiresNotebookConfiguration = Boolean(activeNotebook && !hasNotebookDeploymentConfiguration(activeNotebook));
    const workspaceSessionKey = `${trajectoryId}:${activeNotebook?._id ?? 'shared'}:${startAttempt}`;

    const { mutateAsync: createScriptingSession, isPending: isCreatingJupyterSession } = useCreateScriptingSessionMutation();
    const { mutateAsync: updateNotebook } = useUpdateScriptingNotebookMutation();

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

    const handleDeploymentModalClose = useCallback((options?: { completed?: boolean }) => {
        closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
        setDeploymentModalRequest(null);
        if (!options?.completed) {
            setDeploymentRequiredMessage(activeNotebook
                ? 'Configure this notebook deployment before starting Jupyter.'
                : 'Choose a cluster to create the notebook workspace.'
            );
        } else {
            setDeploymentRequiredMessage(null);
        }
    }, [activeNotebook]);

    const openDeploymentModal = useCallback((request: ScriptingNotebookDeploymentModalRequest) => {
        setDeploymentRequiredMessage(null);
        setDeploymentModalRequest(request);
        openModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
    }, []);

    const startJupyterSession = useCallback(async (deploymentSelection?: ScriptingNotebookDeploymentSelection) => {
        if (!trajectoryId) {
            return;
        }

        if (!activeNotebook && !deploymentSelection) {
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
        const triggerRetry = () => setStartAttempt((value) => value + 1);

        try {
            const isRequestCancelled = (): boolean => {
                return !isMountedRef.current || activeStartRequestRef.current !== requestId;
            };

            const readSession = (session: ScriptingSession) => {
                const sessionNotebookId = getSessionNotebookId(session, activeNotebook);
                if (!sessionNotebookId) {
                    throw new Error('Unable to determine notebook session status because no notebook id was returned.');
                }

                return service.readNotebookSessionStatus({ notebookId: sessionNotebookId });
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
                        notebookId: activeNotebook._id,
                        url: existingSession.jupyter.url
                    });
                    setJupyterUrl(existingSession.jupyter.url);
                    onNotebookIdChange?.(activeNotebook._id);
                    return;
                }

                setContainerStage(existingSession.jupyter.containerStage ?? null);
            }

            const result: WaitForReadyScriptingSessionResult = await startAndWaitForReadyScriptingSession({
                createSession: async () => {
                    const session = await createScriptingSession({
                        trajectoryId,
                        notebookId: activeNotebook?._id,
                        teamClusterId: deploymentSelection?.teamClusterId
                    });
                    if (!isRequestCancelled()) {
                        setContainerStage(session.jupyter.containerStage ?? 'creating');
                        const sessionNotebookId = getSessionNotebookId(session, activeNotebook);
                        if (sessionNotebookId) {
                            onNotebookIdChange?.(sessionNotebookId);
                        }
                    }
                    return session;
                },
                readSession
            }, waitForReadyOptions);

            if (isRequestCancelled()) {
                sileo.dismiss(loadingToastId);
                return;
            }

            sileo.dismiss(loadingToastId);

            const resultNotebookId = getSessionNotebookId(result.session, activeNotebook);
            if (resultNotebookId) {
                onNotebookIdChange?.(resultNotebookId);
            }

            if (!activeNotebook && resultNotebookId) {
                await queryClient.invalidateQueries({ queryKey: scriptingNotebooksQueryKey() });
                await notebooksQuery.refetch();
            }

            if (!result.timedOut && result.session.jupyter.ready) {
                setContainerStage('ready');
                rememberReadyJupyterUrl({
                    trajectoryId,
                    notebookId: resultNotebookId,
                    url: result.session.jupyter.url
                });
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
                    onClick: triggerRetry
                }
            });
        } catch (error: unknown) {
            if (!isMountedRef.current || activeStartRequestRef.current !== requestId) {
                sileo.dismiss(loadingToastId);
                return;
            }

            sileo.dismiss(loadingToastId);

            if (!checkAccessDeniedError(error)) {
                setJupyterError(getJupyterStartErrorMessage(error));
                sileo.error({
                    title: 'Failed to start Jupyter session',
                    description: getJupyterStartErrorMessage(error),
                    duration: 8000,
                    button: {
                        title: 'Retry',
                        onClick: triggerRetry
                    }
                });
            }
        } finally {
            if (isMountedRef.current && activeStartRequestRef.current === requestId) {
                setIsWaitingForJupyter(false);
            }
        }
    }, [activeNotebook, checkAccessDeniedError, createScriptingSession, notebooksQuery, onNotebookIdChange, trajectoryId]);

    useEffect(() => {
        if (!trajectoryId || notebooksQuery.isLoading || !teamId) {
            return;
        }

        if (requiresNotebookCreation && notebooksQuery.isFetching) {
            return;
        }

        const promptKey = requiresNotebookCreation
            ? `create:${trajectoryId}`
            : requiresNotebookConfiguration && activeNotebook
                ? `configure:${activeNotebook._id}`
                : null;

        if (!promptKey || deploymentModalRequest) {
            return;
        }

        if (lastDeploymentPromptKeyRef.current === promptKey) {
            return;
        }

        lastDeploymentPromptKeyRef.current = promptKey;

        if (requiresNotebookConfiguration && activeNotebook) {
            openDeploymentModal({
                teamId,
                notebook: activeNotebook,
                title: 'Configure Notebook Deployment',
                description: 'Select the cluster this notebook should use before starting Jupyter.',
                confirmLabel: 'Save and start',
                onSubmit: async ({ teamClusterId }) => {
                    await showPromise(
                        updateNotebook({
                            notebookId: activeNotebook._id,
                            teamClusterId
                        }),
                        SAVE_NOTEBOOK_DEPLOYMENT_TOAST
                    );
                    await notebooksQuery.refetch();
                    setStartAttempt((value) => value + 1);
                }
            });
            return;
        }

        openDeploymentModal({
            teamId,
            title: 'Create Notebook Workspace',
            description: 'Choose the cluster for the notebook container before starting Jupyter.',
            confirmLabel: 'Start notebook',
            onSubmit: async (selection) => {
                await startJupyterSession(selection);
            }
        });
    }, [
        activeNotebook,
        deploymentModalRequest,
        notebooksQuery.isFetching,
        notebooksQuery,
        openDeploymentModal,
        requiresNotebookConfiguration,
        requiresNotebookCreation,
        startJupyterSession,
        teamId,
        trajectoryId,
        updateNotebook
    ]);

    useEffect(() => {
        if (!trajectoryId || notebooksQuery.isLoading || requiresNotebookCreation || requiresNotebookConfiguration) {
            return;
        }

        if (lastStartedWorkspaceKeyRef.current === workspaceSessionKey) {
            return;
        }

        lastStartedWorkspaceKeyRef.current = workspaceSessionKey;
        startJupyterSession();
    }, [
        notebooksQuery.isLoading,
        requiresNotebookConfiguration,
        requiresNotebookCreation,
        startJupyterSession,
        trajectoryId,
        workspaceSessionKey
    ]);

    const retryStartJupyter = () => {
        if (!trajectoryId || isWaitingForJupyter || isCreatingJupyterSession) {
            return;
        }

        if (teamId && (requiresNotebookCreation || (requiresNotebookConfiguration && activeNotebook))) {
            lastDeploymentPromptKeyRef.current = null;
            setDeploymentRequiredMessage(null);
            return;
        }

        setStartAttempt((value) => value + 1);
    };

    return {
        isLoading: notebooksQuery.isLoading,
        activeNotebook,
        isStartingJupyter: isWaitingForJupyter || isCreatingJupyterSession,
        error: jupyterError,
        deploymentRequiredMessage,
        deploymentModalRequest,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        containerStage,
        handleDeploymentModalClose,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
