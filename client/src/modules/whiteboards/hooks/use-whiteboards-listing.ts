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
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import { SOCKET_WHITEBOARD_EVENTS } from '@/modules/socket/events/whiteboards';
import useFolderedListingDragAndDropMove from '@/shared/presentation/hooks/use-foldered-listing-drag-and-drop-move';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useFolderedListingMoveModal from '@/shared/presentation/hooks/use-foldered-listing-move-modal';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useRenameFolderModal from '@/shared/presentation/hooks/use-rename-folder-modal';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FOLDER_LIST_LIMIT, ROOT_FOLDER_ID } from '@/shared/presentation/constants/foldered-listing';
import { FolderInput, FolderOpen, Pencil, SquarePen, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { createEmptyWhiteboardsResponse, getDeleteConfirmationMessage, getSafeFolderTitle, getSafeWhiteboardTitle } from '../utilities/whiteboards';
import {
    createWhiteboardFolderRow,
    createWhiteboardItemRow,
    getWhiteboardListingDraggableId,
    getWhiteboardListingDroppableId,
    isWhiteboardFolderRow,
    isWhiteboardItemRow
} from '../utilities/listing';
import type { WhiteboardFolder } from '@/modules/whiteboards/api/entities/whiteboard-folder';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { WhiteboardListingRow } from '@/modules/whiteboards/utilities/listing';
import { useNavigate } from 'react-router-dom';

interface WhiteboardMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
};

const getWhiteboardMoveTarget = (whiteboard: Whiteboard): WhiteboardMoveTarget => ({
    _id: whiteboard._id,
    title: getSafeWhiteboardTitle(whiteboard.title),
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
const CREATE_FOLDER_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Folder' });
const RENAME_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Whiteboard' });
const RENAME_FOLDER_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Folder' });
const DELETE_FOLDER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Folder' });
const MOVE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Whiteboard' });

const fetchWhiteboards = (params: PaginationParams & FolderedListingContext): Promise<PaginatedResponse<Whiteboard>> => {
    return whiteboardsQuery.fetch({
        page: params.page,
        limit: params.limit,
        folderId: params.folderId ?? ROOT_FOLDER_ID
    });
};

const fetchFolders = (folderId: string | null): Promise<PaginatedResponse<WhiteboardFolder>> => {
    return whiteboardFoldersQuery.fetch({
        page: 1,
        limit: FOLDER_LIST_LIMIT,
        ...(folderId ? { parentId: folderId } : {})
    });
};

const fetchFolderById = (folderId: string): Promise<WhiteboardFolder> => {
    return whiteboardFolderQuery.fetch({ folderId });
};

const getDeleteFolderConfirmDescription = (folderTitle: string): string => {
    return `Delete "${getSafeFolderTitle(folderTitle)}"? Nested folders and all whiteboards inside them will be deleted recursively.`;
};

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

    const [renamingWhiteboard, setRenamingWhiteboard] = useState<Whiteboard | null>(null);
    const {
        breadcrumbs,
        context,
        currentFolder,
        currentFolderId,
        fetchData,
        getMoveFolder,
        goToRoot,
        handleCreateFolder,
        handleDeleteFolder,
        handleDeleteCurrentFolder,
        handleRenameFolderClose: handleRenameFolderStateClose,
        handleRenameFolderOpen: handleRenameFolderStateOpen,
        handleRenameFolderSubmit: handleRenameFolderStateSubmit,
        isInsideFolder,
        listMoveFolders,
        navigateToFolder,
        openFolder,
        renamingFolder
    } = useFolderedListing<Whiteboard, WhiteboardFolder, WhiteboardListingRow>({
        teamId,
        fetchItems: fetchWhiteboards,
        fetchFolders,
        getFolder: fetchFolderById,
        createEmptyResponse: createEmptyWhiteboardsResponse,
        mapFolderRow: createWhiteboardFolderRow,
        mapItemRow: createWhiteboardItemRow,
        onFetchErrorTitle: 'Failed to fetch whiteboards',
        invalidFolderMessage: 'This whiteboard folder no longer exists. Showing Root instead.',
        createFolder: createWhiteboardFolder,
        createFolderToast: CREATE_FOLDER_TOAST,
        updateFolder: updateWhiteboardFolder,
        renameFolderToast: RENAME_FOLDER_TOAST,
        deleteFolder: deleteWhiteboardFolder,
        deleteFolderToast: DELETE_FOLDER_TOAST,
        getDeleteFolderConfirm: (folder) => ({
            title: getDeleteFolderConfirmDescription(folder.title),
            description: 'This permanently deletes the folder tree and every whiteboard contained in it.'
        })
    });

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createWhiteboard({
                teamId,
                title: 'Untitled Whiteboard',
                folderId: currentFolderId
            }),
            CREATE_WHITEBOARD_TOAST
        );
    }, [currentFolderId, createWhiteboard, teamId]);

    const handleRenameWhiteboardOpen = useCallback((whiteboard: Whiteboard) => {
        setRenamingWhiteboard(whiteboard);
        openModal(RENAME_WHITEBOARD_MODAL_ID);
    }, []);

    const handleRenameWhiteboardClose = useCallback(() => {
        closeModal(RENAME_WHITEBOARD_MODAL_ID);
        setRenamingWhiteboard(null);
    }, []);

    const handleRenameWhiteboardSubmit = useCallback(async (title: string) => {
        if (!renamingWhiteboard) {
            return;
        }

        await showPromise(
            updateWhiteboard({
                whiteboardId: renamingWhiteboard._id,
                title
            }),
            RENAME_WHITEBOARD_TOAST
        );

        handleRenameWhiteboardClose();
    }, [handleRenameWhiteboardClose, renamingWhiteboard, updateWhiteboard]);

    const {
        handleRenameFolderOpen,
        handleRenameFolderClose,
        handleRenameFolderSubmit
    } = useRenameFolderModal({
        modalId: RENAME_WHITEBOARD_FOLDER_MODAL_ID,
        openRenameState: handleRenameFolderStateOpen,
        closeRenameState: handleRenameFolderStateClose,
        submitRenameState: handleRenameFolderStateSubmit
    });

    const moveWhiteboardToFolder = useCallback((whiteboardId: string, folderId: string | null) => {
        return moveWhiteboard({ whiteboardId, folderId });
    }, [moveWhiteboard]);

    const {
        movingItem: movingWhiteboard,
        handleMoveOpen: handleMoveWhiteboardOpen,
        handleMoveClose: handleMoveWhiteboardClose,
        handleMoveSubmit: handleMoveWhiteboardSubmit
    } = useFolderedListingMoveModal<Whiteboard, WhiteboardMoveTarget>({
        modalId: MOVE_WHITEBOARD_MODAL_ID,
        getMoveTarget: getWhiteboardMoveTarget,
        moveItem: moveWhiteboardToFolder,
        moveToast: MOVE_WHITEBOARD_TOAST
    });

    const { getMenuOptions: getWhiteboardMenuOptions } = useListingActions<Whiteboard>({
        actions: {
            open: {
                label: 'Open Whiteboard',
                icon: SquarePen,
                handler: ({ item: whiteboard }) => {
                    navigate(`/dashboard/whiteboard/${whiteboard._id}`);
                },
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
                    handleMoveWhiteboardOpen(whiteboard);
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
        }
    });

    const { getMenuOptions: getFolderMenuOptions } = useListingActions<WhiteboardFolder>({
        actions: {
            open: {
                label: 'Open Folder',
                icon: FolderOpen,
                handler: ({ item: folder }) => {
                    openFolder(folder._id);
                }
            },
            rename: {
                label: 'Rename Folder',
                icon: Pencil,
                handler: ({ item: folder }) => {
                    handleRenameFolderOpen(folder);
                },
                requiredPermission: 'whiteboard:update'
            },
            delete: {
                label: 'Delete Folder',
                icon: Trash2,
                variant: 'danger',
                handler: async ({ item: folder }) => {
                    await handleDeleteFolder(folder);
                },
                requiredPermission: 'whiteboard:delete'
            }
        }
    });

    const getMenuOptions = useCallback((item: WhiteboardListingRow, selectedItems: WhiteboardListingRow[]): MenuOption[] => {
        if (isWhiteboardFolderRow(item)) {
            return getFolderMenuOptions(item, [item]);
        }

        const selectedWhiteboards = selectedItems.filter(isWhiteboardItemRow);
        return getWhiteboardMenuOptions(item, selectedWhiteboards);
    }, [getFolderMenuOptions, getWhiteboardMenuOptions]);

    const handleItemClick = useCallback((item: WhiteboardListingRow): boolean => {
        if (isWhiteboardFolderRow(item)) {
            openFolder(item._id);
            return true;
        }

        navigate(`/dashboard/whiteboard/${item._id}`);
        return true;
    }, [navigate, openFolder]);

    const dragAndDrop = useFolderedListingDragAndDropMove({
        canMove: canMoveWhiteboards,
        activationDistance: 6,
        getDraggableId: getWhiteboardListingDraggableId,
        getDroppableId: getWhiteboardListingDroppableId,
        isItemRow: isWhiteboardItemRow,
        isFolderRow: isWhiteboardFolderRow,
        moveItem: moveWhiteboardToFolder,
        moveToast: MOVE_WHITEBOARD_TOAST
    });

    return {
        breadcrumbs,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        getMenuOptions,
        getMoveFolder,
        goToRoot,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveWhiteboardClose,
        handleMoveWhiteboardSubmit,
        handleRenameWhiteboardClose,
        handleRenameWhiteboardSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        isInsideFolder,
        listMoveFolders,
        movingWhiteboard,
        navigateToFolder,
        queryKey: whiteboardsQueryKey(),
        renamingWhiteboard,
        renamingFolder,
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useWhiteboardsListing;
