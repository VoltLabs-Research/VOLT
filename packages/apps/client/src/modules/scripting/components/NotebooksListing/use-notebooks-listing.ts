import { RENAME_SCRIPTING_NOTEBOOK_MODAL_ID, SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID } from '@/modules/scripting/contracts/modal-ids';
import service from '@/modules/scripting/api/scripting-service';
import {
    scriptingNotebooksQueryKey,
    useCreateScriptingNotebookMutation,
    useCreateScriptingSessionMutation,
    useDeleteScriptingNotebookMutation,
    useUpdateScriptingNotebookMutation
} from '@/modules/scripting/hooks/queries';
import { isAccessDeniedError } from '@/shared/errors/core/report-error';
import { SOCKET_NOTEBOOK_EVENTS } from '@/modules/socket/events/scripting';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { closeModal, openModal } from '@/shared/ui/modal/use-modal-store';
import { showPromise } from '@/shared/ui/hooks/toast';
import { createCrudToastOptions } from '@/shared/ui/utils/toast-options';
import useListingActions from '@/shared/ui/hooks/use-listing-actions';
import useRenameEntityModal from '@/shared/ui/hooks/use-rename-entity-modal';
import {
    JUPYTER_SESSION_PENDING_MESSAGE,
    JUPYTER_SESSION_TIMEOUT_MESSAGE,
    getJupyterStartErrorMessage,
    startAndWaitForReadyScriptingSession
} from '../../utils/jupyter-session';
import { renderNotebookStartupTab } from '../../utils/notebook-startup-tab';
import {
    getDeleteConfirmationMessage,
    getNotebookTeamClusterId,
    getNotebookTrajectoryId
} from '../../utils/notebooks';
import { FolderOpen, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { sileo } from 'sileo';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import type {
    ScriptingNotebook
} from '@volt/contracts/modules/scripting/domain';
import { createEmptyPaginatedResponse } from '@/shared/pagination/create-empty-paginated-response';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { PaginationParams } from '@/shared/ui/hooks/use-pagination-params';
import type { ScriptingNotebookDeploymentModalRequest } from '@/modules/scripting/contracts/notebook-deployment';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import { useNavigate } from 'react-router-dom';
export interface NotebooksListingContext {
    scope: ScriptingNotebookScope;
};


const NEW_TAB_BLOCKED_ERROR = 'Unable to open a new tab. Please allow pop-ups for this site.';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    {
        event: SOCKET_NOTEBOOK_EVENTS.DELETED,
        queryKeys: [scriptingNotebooksQueryKey()]
    }
];

const DELETE_NOTEBOOK_TOAST = createCrudToastOptions({
    action: 'Deleting',
    subject: 'Notebook'
});

const CREATE_NOTEBOOK_TOAST = {
    loading: { title: 'Creating notebook...' },
    success: { title: 'Notebook created successfully' },
    error: { title: 'Failed to create notebook' }
};

const RENAME_NOTEBOOK_TOAST = createCrudToastOptions({
    action: 'Renaming',
    subject: 'Notebook'
});

const SAVE_NOTEBOOK_DEPLOYMENT_TOAST = createCrudToastOptions({
    action: 'Saving',
    subject: 'notebook deployment',
    success: 'Notebook deployment saved successfully'
});

// Where the client runs its stack, notebooks open in its own editor, with their kernels in this
// window; on a server, in Jupyter on one of the team's clusters.
const opensInBrowser = localStackMode.isEnabled();

export const notebookEditorPath = (notebookId: string): string => `/dashboard/notebooks/${encodeURIComponent(notebookId)}`;

const useNotebooksListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { mutateAsync: createNotebook } = useCreateScriptingNotebookMutation();
    const { mutateAsync: createScriptingSession } = useCreateScriptingSessionMutation();
    const { mutateAsync: deleteNotebook } = useDeleteScriptingNotebookMutation();
    const { mutateAsync: updateNotebook } = useUpdateScriptingNotebookMutation();
    const [deploymentModalRequest, setDeploymentModalRequest] = useState<ScriptingNotebookDeploymentModalRequest | null>(null);

    const fetchData = useCallback(async (
        params: PaginationParams & NotebooksListingContext
    ): Promise<PaginatedResponse<ScriptingNotebook>> => {
        if (!teamId) {
            return createEmptyPaginatedResponse(params);
        }

        try {
            return await service.listNotebooks({
                page: params.page,
                limit: params.limit,
                scope: params.scope
            });
        } catch (error) {
            if (isAccessDeniedError(error)) {
                throw error;
            }

            sileo.error({ title: 'Failed to fetch notebooks' });
            return createEmptyPaginatedResponse(params);
        }
    }, [teamId]);

    const handleDeploymentModalClose = useCallback(() => {
        closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
        setDeploymentModalRequest(null);
    }, []);

    const openDeploymentModal = useCallback((request: ScriptingNotebookDeploymentModalRequest) => {
        setDeploymentModalRequest(request);
        openModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
    }, []);

    const launchNotebookInNewTab = useCallback(async (notebook: ScriptingNotebook) => {
        if (!teamId) {
            return;
        }

        const notebookTab = window.open('about:blank', '_blank');
        if (!notebookTab) {
            sileo.error({
                title: 'Unable to open notebook',
                description: NEW_TAB_BLOCKED_ERROR
            });
            return;
        }

        notebookTab.opener = null;
        renderNotebookStartupTab(notebookTab, {
            title: 'Opening notebook...',
            description: JUPYTER_SESSION_PENDING_MESSAGE
        });

        try {
            const result = await startAndWaitForReadyScriptingSession({
                createSession: () => createScriptingSession({
                    notebookId: notebook._id
                }),
                readSession: () => service.readNotebookSessionStatus({ notebookId: notebook._id })
            }, {
                isCancelled: () => notebookTab.closed
            });

            if (notebookTab.closed) {
                return;
            }

            if (result.timedOut || !result.session.jupyter.ready) {
                renderNotebookStartupTab(notebookTab, {
                    title: 'Notebook is still starting',
                    description: JUPYTER_SESSION_TIMEOUT_MESSAGE
                });
                sileo.error({
                    title: 'Jupyter is still starting',
                    description: JUPYTER_SESSION_TIMEOUT_MESSAGE
                });
                return;
            }

            notebookTab.location.replace(result.session.jupyter.url);
        } catch (error: unknown) {
            notebookTab.close();

            if (isAccessDeniedError(error)) {
                return;
            }

            sileo.error({
                title: 'Failed to start Jupyter session',
                description: getJupyterStartErrorMessage(error)
            });
        }
    }, [createScriptingSession, teamId]);

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        // Its kernel runs here: there is no cluster to choose.
        if (opensInBrowser) {
            const notebook = await showPromise(createNotebook({ teamId }), CREATE_NOTEBOOK_TOAST);
            navigate(notebookEditorPath(notebook._id));
            return;
        }

        openDeploymentModal({
            teamId,
            title: 'Create Notebook',
            description: 'Choose the cluster for this notebook before saving it.',
            confirmLabel: 'Create notebook',
            onSubmit: async ({ teamClusterId }) => {
                await showPromise(
                    createNotebook({
                        teamId,
                        teamClusterId
                    }),
                    CREATE_NOTEBOOK_TOAST
                );
            }
        });
    }, [teamId, createNotebook, navigate, openDeploymentModal]);

    const {
        renamingEntity: renamingNotebook,
        handleRenameOpen,
        handleRenameClose,
        handleRenameSubmit
    } = useRenameEntityModal({
        modalId: RENAME_SCRIPTING_NOTEBOOK_MODAL_ID,
        updateEntity: updateNotebook,
        getUpdateParams: (notebook: ScriptingNotebook, title) => ({
            notebookId: notebook._id,
            title
        }),
        renameToast: RENAME_NOTEBOOK_TOAST
    });

    const handleOpenInNewTab = useCallback(async (notebook: ScriptingNotebook) => {
        if (opensInBrowser) {
            navigate(notebookEditorPath(notebook._id));
            return;
        }

        const trajectoryId = getNotebookTrajectoryId(notebook);

        if (trajectoryId) {
            navigate(`/canvas/${trajectoryId}?workspace=scripting&notebook=${encodeURIComponent(notebook._id)}`);
            return;
        }

        if (!teamId) {
            return;
        }

        if (!getNotebookTeamClusterId(notebook)) {
            openDeploymentModal({
                teamId,
                notebook,
                title: 'Configure Notebook Deployment',
                description: 'Select the cluster this notebook should use before opening Jupyter.',
                confirmLabel: 'Save and open',
                onSubmit: async ({ teamClusterId }) => {
                    const updatedNotebook = await showPromise(
                        updateNotebook({
                            notebookId: notebook._id,
                            teamClusterId
                        }),
                        SAVE_NOTEBOOK_DEPLOYMENT_TOAST
                    );
                    await launchNotebookInNewTab(updatedNotebook);
                }
            });
            return;
        }

        await launchNotebookInNewTab(notebook);
    }, [launchNotebookInNewTab, navigate, openDeploymentModal, teamId, updateNotebook]);

    const { getMenuOptions } = useListingActions<ScriptingNotebook>({
        actions: {
            open: {
                label: opensInBrowser ? 'Open' : 'Open in new Tab',
                icon: FolderOpen,
                handler: async ({ item: notebook }) => {
                    await handleOpenInNewTab(notebook);
                },
                requiredPermission: 'plugin:read'
            },
            rename: {
                label: 'Rename',
                icon: Pencil,
                handler: ({ item: notebook }) => {
                    handleRenameOpen(notebook);
                },
                requiredPermission: 'plugin:update'
            },
            delete: {
                variant: 'danger',
                handler: async ({ item: notebook }) => {
                    await showPromise(
                        deleteNotebook({ notebookId: notebook._id }),
                        DELETE_NOTEBOOK_TOAST
                    );
                },
                confirm: ({ selectedItems }) => getDeleteConfirmationMessage(selectedItems),
                requiredPermission: 'plugin:delete'
            }
        }
    });

    // A click opens the notebook as the menu's Open does. Its tab is opened inside this click, before any await, so it isn't blocked as a popup.
    const handleItemClick = useCallback((notebook: ScriptingNotebook): boolean => {
        void handleOpenInNewTab(notebook);
        return true;
    }, [handleOpenInNewTab]);

    return {
        opensInBrowser,
        fetchData,
        getMenuOptions,
        handleItemClick,
        handleCreate,
        handleDeploymentModalClose,
        handleRenameClose,
        handleRenameSubmit,
        deploymentModalRequest,
        renamingNotebook,
        queryKey: scriptingNotebooksQueryKey(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useNotebooksListing;
