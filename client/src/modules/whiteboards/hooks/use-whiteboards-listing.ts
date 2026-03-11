import { isAccessDeniedError } from '@/shared/errors/notify-api-error';
import {
    whiteboardsQuery,
    whiteboardsQueryKey,
    useDeleteWhiteboardMutation,
    useCreateWhiteboardMutation,
    invalidateWhiteboardsQuery
} from '@/modules/whiteboards/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { createEmptyWhiteboardsResponse, getDeleteConfirmationMessage } from '../utilities/whiteboards';
import { SquarePen } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const fetchWhiteboards = (params: PaginationParams): Promise<PaginatedResponse<Whiteboard>> => {
    return whiteboardsQuery.fetch({
        page: params.page,
        limit: params.limit
    });
};

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'whiteboard.deleted', queryKeys: [whiteboardsQueryKey()] }
];

const DELETE_WHITEBOARD_TOAST = {
    loading: { title: 'Deleting whiteboard...' },
    success: { title: 'Whiteboard deleted successfully' },
    error: { title: 'Failed to delete whiteboard' }
};

const CREATE_WHITEBOARD_TOAST = {
    loading: { title: 'Creating whiteboard...' },
    success: { title: 'Whiteboard created successfully' },
    error: { title: 'Failed to create whiteboard' }
};

const useWhiteboardsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { mutateAsync: deleteWhiteboard } = useDeleteWhiteboardMutation();
    const { mutateAsync: createWhiteboard } = useCreateWhiteboardMutation();

    const fetchData = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<Whiteboard>> => {
        if (!teamId) {
            return createEmptyWhiteboardsResponse(params);
        }

        try {
            const result = await fetchWhiteboards(params);

            return {
                ...result,
                data: result.data || []
            };
        } catch (error) {
            if (isAccessDeniedError(error)) {
                throw error;
            }

            sileo.error({ title: 'Failed to fetch whiteboards' });
            return createEmptyWhiteboardsResponse(params);
        }
    }, [teamId]);

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createWhiteboard({ teamId, title: 'Untitled Whiteboard' }).then((whiteboard) => {
                invalidateWhiteboardsQuery();
                navigate(`/dashboard/whiteboard/${whiteboard._id}`);
            }),
            CREATE_WHITEBOARD_TOAST
        );
    }, [teamId, createWhiteboard, navigate]);

    const { getMenuOptions } = useListingActions<Whiteboard>({
        actions: {
            open: {
                label: 'Open Whiteboard',
                icon: SquarePen,
                handler: ({ item: whiteboard }) => {
                    navigate(`/dashboard/whiteboard/${whiteboard._id}`);
                },
                requiredPermission: 'whiteboard:read'
            },
            delete: {
                variant: 'danger',
                handler: async ({ item: whiteboard }) => {
                    await showPromise(
                        deleteWhiteboard({ whiteboardId: whiteboard._id }),
                        DELETE_WHITEBOARD_TOAST
                    );
                },
                confirm: ({ selectedItems }) => getDeleteConfirmationMessage(selectedItems),
                requiredPermission: 'whiteboard:delete'
            }
        }
    });

    return {
        fetchData,
        getMenuOptions,
        handleCreate,
        queryKey: whiteboardsQueryKey(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useWhiteboardsListing;
