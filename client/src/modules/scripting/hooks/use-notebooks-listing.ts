import { isAccessDeniedError } from '@/shared/errors/notify-api-error';
import {
    scriptingNotebooksQuery,
    scriptingNotebooksQueryKey,
    useDeleteScriptingNotebookMutation
} from '@/modules/scripting/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { FolderOpen } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import {
    createEmptyNotebooksResponse,
    getDeleteConfirmationMessage,
    getTrajectoryIds
} from '../utilities/notebooks';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const fetchNotebooks = (params: PaginationParams): Promise<PaginatedResponse<ScriptingNotebook>> => {
    return scriptingNotebooksQuery.fetch({
        page: params.page,
        limit: params.limit
    });
};

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'notebook.deleted', queryKeys: [scriptingNotebooksQueryKey()] }
];

const DELETE_NOTEBOOK_TOAST = {
    loading: { title: 'Deleting notebook...' },
    success: { title: 'Notebook deleted successfully' },
    error: { title: 'Failed to delete notebook' }
};

const NOTEBOOK_OPEN_ERROR = 'This notebook has no associated trajectory.';

const useNotebooksListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { mutateAsync: deleteNotebook } = useDeleteScriptingNotebookMutation();

    const fetchData = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<ScriptingNotebook>> => {
        if (!teamId) {
            return createEmptyNotebooksResponse(params);
        }

        try {
            const result = await fetchNotebooks(params);

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

    const { getMenuOptions } = useListingActions<ScriptingNotebook>({
        actions: {
            open: {
                label: 'Open in Canvas Workspace',
                icon: FolderOpen,
                handler: ({ item: notebook }) => {
                    const trajectoryId = getTrajectoryIds(notebook)[0];

                    if (!trajectoryId) {
                        sileo.error({ title: NOTEBOOK_OPEN_ERROR });
                        return;
                    }

                    navigate(`/canvas/${trajectoryId}?workspace=scripting&notebook=${encodeURIComponent(notebook._id)}`);
                },
                requiredPermission: 'plugin:read'
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
        fetchData,
        getMenuOptions,
        queryKey: scriptingNotebooksQueryKey(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useNotebooksListing;
