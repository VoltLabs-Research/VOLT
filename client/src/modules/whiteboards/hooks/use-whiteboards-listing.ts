import {
    useCreateWhiteboardFolderMutation,
    useCreateWhiteboardMutation,
    useDeleteWhiteboardFolderMutation,
    useDeleteWhiteboardMutation,
    useMoveWhiteboardMutation,
    useUpdateWhiteboardMutation,
    useUpdateWhiteboardFolderMutation,
    whiteboardFolderQuery,
    whiteboardFoldersQuery,
    whiteboardsQuery,
    whiteboardsQueryKey
} from '@/modules/whiteboards/hooks/queries';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import { SOCKET_WHITEBOARD_EVENTS } from '@/modules/socket/events/whiteboards';
import useFolderedResourceListing from '@/shared/ui/hooks/use-foldered-resource-listing';
import { createFolderedListingResource } from '@/shared/ui/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/ui/hooks/use-listing-actions';
import useRenameEntityModal from '@/shared/ui/hooks/use-rename-entity-modal';
import { showPromise } from '@/shared/ui/hooks/toast';
import { FolderInput, Pencil, SquarePen } from 'lucide-react';
import { useCallback } from 'react';
import {
    createWhiteboardFolderRow,
    createWhiteboardItemRow,
    getWhiteboardListingDraggableId,
    getWhiteboardListingDroppableId,
    isWhiteboardFolderRow,
    isWhiteboardItemRow
} from '../utils/listing';
import type { WhiteboardItemRow } from '../contracts/listing';
import type { Whiteboard } from '@volt/contracts/modules/whiteboards/domain';
import { useNavigate } from 'react-router-dom';

export const RENAME_WHITEBOARD_MODAL_ID = 'rename-whiteboard-modal';

export const whiteboardsListingResource = createFolderedListingResource({
    subject: 'Whiteboard',
    singularName: 'whiteboard',
    pluralName: 'whiteboards',
    permissionPrefix: 'whiteboard',
    listItems: whiteboardsQuery.fetch,
    listFolders: whiteboardFoldersQuery.fetch,
    getFolder: whiteboardFolderQuery.fetch,
    includeSearch: false
});

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    {
        event: SOCKET_WHITEBOARD_EVENTS.DELETED,
        queryKeys: [whiteboardsQueryKey()]
    }
];

const useWhiteboardsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const canMoveWhiteboards = canAccess(['whiteboard:update']);
    const { mutateAsync: deleteWhiteboard } = useDeleteWhiteboardMutation();
    const { mutateAsync: createWhiteboard } = useCreateWhiteboardMutation();
    const { mutateAsync: updateWhiteboard } = useUpdateWhiteboardMutation();
    const { mutateAsync: createWhiteboardFolder } = useCreateWhiteboardFolderMutation();
    const { mutateAsync: updateWhiteboardFolder } = useUpdateWhiteboardFolderMutation();
    const { mutateAsync: deleteWhiteboardFolder } = useDeleteWhiteboardFolderMutation();
    const { mutateAsync: moveWhiteboard } = useMoveWhiteboardMutation();

    const {
        renamingEntity: renamingWhiteboard,
        handleRenameOpen: handleRenameWhiteboardOpen,
        handleRenameClose: handleRenameWhiteboardClose,
        handleRenameSubmit: handleRenameWhiteboardSubmit
    } = useRenameEntityModal({
        modalId: RENAME_WHITEBOARD_MODAL_ID,
        updateEntity: updateWhiteboard,
        getUpdateParams: (whiteboard: Whiteboard, title) => ({
            whiteboardId: whiteboard._id,
            title
        }),
        renameToast: whiteboardsListingResource.toasts.rename
    });

    const moveWhiteboardToFolder = useCallback((whiteboardId: string, folderId: string | null) => {
        return moveWhiteboard({
            whiteboardId,
            folderId
        });
    }, [moveWhiteboard]);

    const openWhiteboard = useCallback((whiteboard: Whiteboard) => {
        navigate(`/dashboard/whiteboard/${whiteboard._id}`);
    }, [navigate]);

    const getWhiteboardActions = useCallback(({ openMove }: { openMove: (whiteboard: WhiteboardItemRow) => void }): Record<string, ActionConfig<WhiteboardItemRow>> => ({
        open: {
            label: 'Open Whiteboard',
            icon: SquarePen,
            handler: ({ item: whiteboard }) => openWhiteboard(whiteboard),
            requiredPermission: 'whiteboard:read'
        },
        rename: {
            label: 'Rename',
            icon: Pencil,
            handler: ({ item: whiteboard }) => {
                handleRenameWhiteboardOpen(whiteboard);
            },
            requiredPermission: 'whiteboard:update'
        },
        move: {
            label: 'Move to Folder',
            icon: FolderInput,
            handler: ({ item: whiteboard }) => {
                openMove(whiteboard);
            },
            requiredPermission: 'whiteboard:update'
        },
        delete: {
            variant: 'danger',
            handler: async ({ item: whiteboard }) => {
                await showPromise(
                    deleteWhiteboard({ whiteboardId: whiteboard._id }),
                    whiteboardsListingResource.toasts.delete
                );
            },
            confirm: ({ selectedItems }) => whiteboardsListingResource.getDeleteConfirmationMessage(selectedItems),
            requiredPermission: 'whiteboard:delete'
        }
    }), [deleteWhiteboard, handleRenameWhiteboardOpen, openWhiteboard]);

    const folderedListing = useFolderedResourceListing({
        teamId,
        ...whiteboardsListingResource.listingOptions,
        mapFolderRow: createWhiteboardFolderRow,
        mapItemRow: createWhiteboardItemRow,
        createFolder: createWhiteboardFolder,
        updateFolder: updateWhiteboardFolder,
        deleteFolder: deleteWhiteboardFolder,
        canMoveItems: canMoveWhiteboards,
        getDraggableId: getWhiteboardListingDraggableId,
        getDroppableId: getWhiteboardListingDroppableId,
        isItemRow: isWhiteboardItemRow,
        isFolderRow: isWhiteboardFolderRow,
        moveItem: moveWhiteboardToFolder,
        getItemActions: getWhiteboardActions,
        onOpenItem: openWhiteboard
    });

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        const whiteboard = await showPromise(
            createWhiteboard({
                teamId,
                title: 'Untitled Whiteboard',
                folderId: folderedListing.currentFolderId
            }),
            whiteboardsListingResource.toasts.create
        );

        openWhiteboard(whiteboard);
    }, [folderedListing.currentFolderId, createWhiteboard, openWhiteboard, teamId]);

    return {
        ...folderedListing,
        handleCreate,
        handleRenameWhiteboardClose,
        handleRenameWhiteboardSubmit,
        queryKey: whiteboardsQueryKey(),
        renamingWhiteboard,
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useWhiteboardsListing;
