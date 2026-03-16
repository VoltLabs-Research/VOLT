import service from '@/modules/scripting/api/service';
import {
    scriptingNotebooksQueryKey,
    useCreateScriptingNotebookMutation,
    useCreateScriptingNotebookSessionMutation,
    useDeleteScriptingNotebookMutation,
    useUpdateScriptingNotebookMutation
} from '@/modules/scripting/hooks/queries';
import { isAccessDeniedError } from '@/shared/errors/core';
import { ScriptingNotebookScope } from '@/modules/scripting/api/entities/scripting-notebook-scope';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { getValueByPath } from '@/shared/utils/format';
import { sortData } from '@/shared/utils/sort';
import {
    JUPYTER_SESSION_PENDING_MESSAGE,
    JUPYTER_SESSION_TIMEOUT_MESSAGE,
    normalizeScriptingJupyterUrl,
    startAndWaitForReadyScriptingSession
} from '../utilities/jupyter-session';
import {
    createEmptyNotebooksResponse,
    createScriptingNotebooksExport,
    getDeleteConfirmationMessage,
    getNotebookTeamClusterId,
    getTrajectoryIds
} from '../utilities/notebooks';
import { getJupyterStartErrorMessage } from '../utilities/workspace';
import { FolderOpen, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import type { DocumentListingExportParams, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

export interface NotebooksListingContext {
    scope: ScriptingNotebookScope;
};

interface NotebookStartupWindowState {
    title: string;
    description: string;
};

export const RENAME_SCRIPTING_NOTEBOOK_MODAL_ID = 'rename-scripting-notebook-modal';

const EXPORT_PAGE_LIMIT = 500;
const DEFAULT_NOTEBOOK_SCOPE = ScriptingNotebookScope.General;
const NEW_TAB_BLOCKED_ERROR = 'Unable to open a new tab. Please allow pop-ups for this site.';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'notebook.deleted', queryKeys: [scriptingNotebooksQueryKey()] }
];

const DELETE_NOTEBOOK_TOAST = {
    loading: { title: 'Deleting notebook...' },
    success: { title: 'Notebook deleted successfully' },
    error: { title: 'Failed to delete notebook' }
};

const CREATE_NOTEBOOK_TOAST = {
    loading: { title: 'Creating notebook...' },
    success: {
        title: 'Notebook created successfully',
        description: 'General notebooks are added to the List tab.'
    },
    error: { title: 'Failed to create notebook' }
};

const RENAME_NOTEBOOK_TOAST = {
    loading: { title: 'Renaming notebook...' },
    success: { title: 'Notebook renamed successfully' },
    error: { title: 'Failed to rename notebook' }
};

const resolveScope = (scope?: ScriptingNotebookScope): ScriptingNotebookScope => {
    return scope || DEFAULT_NOTEBOOK_SCOPE;
};

const renderNotebookStartupTab = (notebookTab: Window, state: NotebookStartupWindowState): void => {
    if (notebookTab.closed) {
        return;
    }

    const { document } = notebookTab;
    document.title = state.title;
    if (!document.body) {
        return;
    }

    document.body.replaceChildren();
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
    document.body.style.display = 'flex';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.background = 'Canvas';
    document.body.style.color = 'CanvasText';
    document.body.style.fontFamily = 'Inter, system-ui, sans-serif';

    const container = document.createElement('main');
    container.style.maxWidth = '480px';
    container.style.padding = '32px';
    container.style.textAlign = 'center';

    const title = document.createElement('h1');
    title.textContent = state.title;
    title.style.margin = '0 0 12px';
    title.style.fontSize = '24px';

    const description = document.createElement('p');
    description.textContent = state.description;
    description.style.margin = '0';
    description.style.fontSize = '14px';
    description.style.lineHeight = '1.5';
    description.style.color = 'GrayText';

    container.append(title, description);
    document.body.append(container);
};

const useNotebooksListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { mutateAsync: createNotebook } = useCreateScriptingNotebookMutation();
    const { mutateAsync: createNotebookSession } = useCreateScriptingNotebookSessionMutation();
    const { mutateAsync: deleteNotebook } = useDeleteScriptingNotebookMutation();
    const { mutateAsync: updateNotebook } = useUpdateScriptingNotebookMutation();
    const [renamingNotebook, setRenamingNotebook] = useState<ScriptingNotebook | null>(null);

    const fetchData = useCallback(async (
        params: PaginationParams & NotebooksListingContext
    ): Promise<PaginatedResponse<ScriptingNotebook>> => {
        if (!teamId) {
            return createEmptyNotebooksResponse(params);
        }

        try {
            const result = await service.listNotebooks({
                page: params.page,
                limit: params.limit,
                scope: resolveScope(params.scope)
            });

            return {
                ...result,
                data: result.data || []
            };
        } catch (error) {
            if (isAccessDeniedError(error)) {
                throw error;
            }

            sileo.error({ title: 'Failed to fetch notebooks' });
            return createEmptyNotebooksResponse(params);
        }
    }, [teamId]);

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createNotebook({
                teamId,
                title: 'General Notebook'
            }),
            CREATE_NOTEBOOK_TOAST
        );
    }, [teamId, createNotebook]);

    const handleRenameOpen = useCallback((notebook: ScriptingNotebook) => {
        setRenamingNotebook(notebook);
        openModal(RENAME_SCRIPTING_NOTEBOOK_MODAL_ID);
    }, []);

    const handleRenameClose = useCallback(() => {
        closeModal(RENAME_SCRIPTING_NOTEBOOK_MODAL_ID);
        setRenamingNotebook(null);
    }, []);

    const handleRenameSubmit = useCallback(async (title: string) => {
        if (!renamingNotebook) {
            return;
        }

        await showPromise(
            updateNotebook({
                notebookId: renamingNotebook._id,
                title
            }),
            RENAME_NOTEBOOK_TOAST
        );

        handleRenameClose();
    }, [renamingNotebook, updateNotebook, handleRenameClose]);

    const handleOpenInNewTab = useCallback(async (notebook: ScriptingNotebook) => {
        const trajectoryId = getTrajectoryIds(notebook)[0];

        if (trajectoryId) {
            navigate(`/canvas/${trajectoryId}?workspace=scripting&notebook=${encodeURIComponent(notebook._id)}`);
            return;
        }

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
                createSession: () => createNotebookSession({
                    notebookId: notebook._id,
                    teamClusterId: getNotebookTeamClusterId(notebook)
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

            notebookTab.location.replace(normalizeScriptingJupyterUrl(result.session.jupyter.url));
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
    }, [createNotebookSession, navigate, teamId]);

    const exportNotebooks = useCallback(async (
        params: DocumentListingExportParams<NotebooksListingContext>
    ): Promise<Blob> => {
        const notebooks: ScriptingNotebook[] = [];
        const scope = resolveScope(params.context?.scope);
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await service.listNotebooks({
                page,
                limit: EXPORT_PAGE_LIMIT,
                scope
            });

            notebooks.push(...(response.data || []));
            hasMore = response.pagination.hasMore;
            page += 1;
        }

        const sortedNotebooks = sortData(notebooks, params.sort || null, getValueByPath);
        return createScriptingNotebooksExport(sortedNotebooks, params.format);
    }, []);

    const { getMenuOptions } = useListingActions<ScriptingNotebook>({
        actions: {
            open: {
                label: 'Open in new Tab',
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

    return {
        exportNotebooks,
        fetchData,
        getMenuOptions,
        handleCreate,
        handleRenameClose,
        handleRenameSubmit,
        renamingNotebook,
        queryKey: scriptingNotebooksQueryKey(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useNotebooksListing;
