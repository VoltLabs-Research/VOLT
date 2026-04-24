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
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FOLDER_LIST_LIMIT, ROOT_FOLDER_ID } from '@/shared/presentation/constants/foldered-listing';
import { FolderInput, FolderOpen, Pencil, SquarePen, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
type WhiteboardsListingDragAndDropConfig = DocumentListingDragAndDropConfig<WhiteboardListingRow>;

interface WhiteboardMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
};

export const NEW_WHITEBOARD_FOLDER_MODAL_ID = 'new-whiteboard-folder-modal';
export const RENAME_WHITEBOARD_MODAL_ID = 'rename-whiteboard-modal';
export const RENAME_WHITEBOARD_FOLDER_MODAL_ID = 'rename-whiteboard-folder-modal';
export const MOVE_WHITEBOARD_MODAL_ID = 'move-whiteboard-modal';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'whiteboard.deleted', queryKeys: [whiteboardsQueryKey()] }
];

const DELETE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Whiteboard', success: 'Whiteboard deleted successfully', error: 'Failed to delete whiteboard' });
const CREATE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Whiteboard', success: 'Whiteboard created successfully', error: 'Failed to create whiteboard' });
const CREATE_FOLDER_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Folder', success: 'Folder created successfully', error: 'Failed to create folder' });
const RENAME_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Whiteboard', success: 'Whiteboard renamed successfully', error: 'Failed to rename whiteboard' });
const RENAME_FOLDER_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Folder', success: 'Folder renamed successfully', error: 'Failed to rename folder' });
const DELETE_FOLDER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Folder', success: 'Folder deleted successfully', error: 'Failed to delete folder' });
const MOVE_WHITEBOARD_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Whiteboard', success: 'Whiteboard moved successfully', error: 'Failed to move whiteboard' });

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
    const [movingWhiteboard, setMovingWhiteboard] = useState<WhiteboardMoveTarget | null>(null);
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

    const handleRenameFolderOpen = useCallback((folder: WhiteboardFolder) => {
        handleRenameFolderStateOpen(folder);
        openModal(RENAME_WHITEBOARD_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateOpen]);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(RENAME_WHITEBOARD_FOLDER_MODAL_ID);
        handleRenameFolderStateClose();
    }, [handleRenameFolderStateClose]);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        await handleRenameFolderStateSubmit(title);
        closeModal(RENAME_WHITEBOARD_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateSubmit]);

    const handleMoveWhiteboardOpen = useCallback((whiteboard: Whiteboard) => {
        setMovingWhiteboard({
            _id: whiteboard._id,
            title: getSafeWhiteboardTitle(whiteboard.title),
            folder: whiteboard.folder
        });
        openModal(MOVE_WHITEBOARD_MODAL_ID);
    }, []);

    const handleMoveWhiteboardClose = useCallback(() => {
        closeModal(MOVE_WHITEBOARD_MODAL_ID);
        setMovingWhiteboard(null);
    }, []);

    const handleMoveWhiteboardSubmit = useCallback(async (folderId: string | null) => {
        if (!movingWhiteboard) {
            return;
        }

        await showPromise(
            moveWhiteboard({
                whiteboardId: movingWhiteboard._id,
                folderId
            }),
            MOVE_WHITEBOARD_TOAST
        );
    }, [moveWhiteboard, movingWhiteboard]);

    const handleWhiteboardRowDragEnd = useCallback(async (
        payload: Parameters<WhiteboardsListingDragAndDropConfig['onDragEnd']>[0]
    ) => {
        const { activeItem, overItem } = payload;
        if (!activeItem || !overItem) {
            return;
        }

        if (!isWhiteboardItemRow(activeItem) || !isWhiteboardFolderRow(overItem)) {
            return;
        }

        if (activeItem.folder === overItem._id) {
            return;
        }

        await showPromise(
            moveWhiteboard({
                whiteboardId: activeItem._id,
                folderId: overItem._id
            }),
            MOVE_WHITEBOARD_TOAST
        );
    }, [moveWhiteboard]);

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

    const dragAndDrop = useMemo<WhiteboardsListingDragAndDropConfig | undefined>(() => {
        if (!canMoveWhiteboards) {
            return undefined;
        }

        return {
            activationDistance: 6,
            getDraggableId: getWhiteboardListingDraggableId,
            getDroppableId: getWhiteboardListingDroppableId,
            onDragEnd: handleWhiteboardRowDragEnd
        };
    }, [canMoveWhiteboards, handleWhiteboardRowDragEnd]);

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
