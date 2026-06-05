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
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import { SOCKET_WHITEBOARD_EVENTS } from '@/modules/socket/events/whiteboards';
import useFolderedResourceListing from '@/shared/presentation/hooks/use-foldered-resource-listing';
import {
    createFolderedResourceFetchers,
    createFolderResourceDeleteConfirm,
    FOLDER_RESOURCE_TOASTS
} from '@/shared/presentation/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/presentation/hooks/use-listing-actions';
import useRenameEntityModal from '@/shared/presentation/hooks/use-rename-entity-modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions } from '@/shared/presentation/utilities/toast-options';
import { FolderInput, Pencil, SquarePen } from 'lucide-react';
import { useCallback } from 'react';
import { getDeleteConfirmationMessage } from '../utilities/whiteboards';
import {
    createWhiteboardFolderRow,
    createWhiteboardItemRow,
    getWhiteboardListingDraggableId,
    getWhiteboardListingDroppableId,
    isWhiteboardFolderRow,
    isWhiteboardItemRow,
    type WhiteboardItemRow
} from '../utilities/listing';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import { useNavigate } from 'react-router-dom';

interface WhiteboardMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
};

const getWhiteboardMoveTarget = (whiteboard: Whiteboard): WhiteboardMoveTarget => ({
    _id: whiteboard._id,
    title: whiteboard.title,
    folder: whiteboard.folder
});

export const NEW_WHITEBOARD_FOLDER_MODAL_ID = 'new-whiteboard-folder-modal';
export const RENAME_WHITEBOARD_MODAL_ID = 'rename-whiteboard-modal';
export const RENAME_WHITEBOARD_FOLDER_MODAL_ID = 'rename-whiteboard-folder-modal';
export const MOVE_WHITEBOARD_MODAL_ID = 'move-whiteboard-modal';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_WHITEBOARD_EVENTS.DELETED, queryKeys: [whiteboardsQueryKey()] }
];

const DELETE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Whiteboard' });
const CREATE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Whiteboard' });
const RENAME_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Whiteboard' });
const MOVE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Whiteboard' });

const whiteboardFetchers = createFolderedResourceFetchers({
    listItems: whiteboardsQuery.fetch,
    listFolders: whiteboardFoldersQuery.fetch,
    getFolder: whiteboardFolderQuery.fetch,
    includeSearch: false
});

const getDeleteFolderConfirm = createFolderResourceDeleteConfirm({
    pluralName: 'whiteboards',
    singularName: 'whiteboard'
});

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
        getUpdateParams: (whiteboard: Whiteboard, title) => ({ whiteboardId: whiteboard._id, title }),
        renameToast: RENAME_WHITEBOARD_TOAST
    });

    const moveWhiteboardToFolder = useCallback((whiteboardId: string, folderId: string | null) => {
        return moveWhiteboard({ whiteboardId, folderId });
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
                    DELETE_WHITEBOARD_TOAST
                );
            },
            confirm: ({ selectedItems }) => getDeleteConfirmationMessage(selectedItems),
            requiredPermission: 'whiteboard:delete'
        }
    }), [deleteWhiteboard, handleRenameWhiteboardOpen, openWhiteboard]);

    const {
        handleMoveClose,
        handleMoveSubmit,
        movingItem,
        ...folderedListing
    } = useFolderedResourceListing({
        teamId,
        ...whiteboardFetchers,
        mapFolderRow: createWhiteboardFolderRow,
        mapItemRow: createWhiteboardItemRow,
        onFetchErrorTitle: 'Failed to fetch whiteboards',
        invalidFolderMessage: 'This whiteboard folder no longer exists. Showing Root instead.',
        createFolder: createWhiteboardFolder,
        createFolderToast: FOLDER_RESOURCE_TOASTS.create,
        updateFolder: updateWhiteboardFolder,
        renameFolderToast: FOLDER_RESOURCE_TOASTS.rename,
        deleteFolder: deleteWhiteboardFolder,
        deleteFolderToast: FOLDER_RESOURCE_TOASTS.delete,
        getDeleteFolderConfirm,
        renameFolderModalId: RENAME_WHITEBOARD_FOLDER_MODAL_ID,
        moveModalId: MOVE_WHITEBOARD_MODAL_ID,
        canMoveItems: canMoveWhiteboards,
        activationDistance: 6,
        getDraggableId: getWhiteboardListingDraggableId,
        getDroppableId: getWhiteboardListingDroppableId,
        isItemRow: isWhiteboardItemRow,
        isFolderRow: isWhiteboardFolderRow,
        getMoveTarget: getWhiteboardMoveTarget,
        moveItem: moveWhiteboardToFolder,
        moveToast: MOVE_WHITEBOARD_TOAST,
        folderPermissions: {
            rename: 'whiteboard:update',
            delete: 'whiteboard:delete'
        },
        getItemActions: getWhiteboardActions,
        onOpenItem: openWhiteboard
    });

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createWhiteboard({
                teamId,
                title: 'Untitled Whiteboard',
                folderId: folderedListing.currentFolderId
            }),
            CREATE_WHITEBOARD_TOAST
        );
    }, [folderedListing.currentFolderId, createWhiteboard, teamId]);

    return {
        ...folderedListing,
        handleCreate,
        handleMoveWhiteboardClose: handleMoveClose,
        handleMoveWhiteboardSubmit: handleMoveSubmit,
        handleRenameWhiteboardClose,
        handleRenameWhiteboardSubmit,
        movingWhiteboard: movingItem,
        queryKey: whiteboardsQueryKey(),
        renamingWhiteboard,
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useWhiteboardsListing;
