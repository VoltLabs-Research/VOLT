import {
    invalidateWhiteboardFoldersQuery,
    invalidateWhiteboardsQuery,
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
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import useFolderSearchParam from '@/shared/presentation/hooks/use-folder-search-param';
import useFolderBreadcrumbs from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { runAction } from '@/shared/presentation/actions/run-action';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { FolderInput, FolderOpen, Pencil, SquarePen, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import { createEmptyWhiteboardsResponse, getDeleteConfirmationMessage } from '../utilities/whiteboards';
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

interface WhiteboardsListingContext {
    folderId: string | null;
};

type WhiteboardsListingDragAndDropConfig = DocumentListingDragAndDropConfig<WhiteboardListingRow>;

interface WhiteboardMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
};

const FOLDER_LIST_LIMIT = 500;
const ROOT_FOLDER_ID = 'root';

export const NEW_WHITEBOARD_FOLDER_MODAL_ID = 'new-whiteboard-folder-modal';
export const RENAME_WHITEBOARD_MODAL_ID = 'rename-whiteboard-modal';
export const RENAME_WHITEBOARD_FOLDER_MODAL_ID = 'rename-whiteboard-folder-modal';
export const MOVE_WHITEBOARD_MODAL_ID = 'move-whiteboard-modal';

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

const CREATE_FOLDER_TOAST = {
    loading: { title: 'Creating folder...' },
    success: { title: 'Folder created successfully' },
    error: { title: 'Failed to create folder' }
};

const RENAME_WHITEBOARD_TOAST = {
    loading: { title: 'Renaming whiteboard...' },
    success: { title: 'Whiteboard renamed successfully' },
    error: { title: 'Failed to rename whiteboard' }
};

const RENAME_FOLDER_TOAST = {
    loading: { title: 'Renaming folder...' },
    success: { title: 'Folder renamed successfully' },
    error: { title: 'Failed to rename folder' }
};

const DELETE_FOLDER_TOAST = {
    loading: { title: 'Deleting folder...' },
    success: { title: 'Folder deleted successfully' },
    error: { title: 'Failed to delete folder' }
};

const MOVE_WHITEBOARD_TOAST = {
    loading: { title: 'Moving whiteboard...' },
    success: { title: 'Whiteboard moved successfully' },
    error: { title: 'Failed to move whiteboard' }
};

const fetchWhiteboards = (params: PaginationParams & WhiteboardsListingContext): Promise<PaginatedResponse<Whiteboard>> => {
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
    return `Delete "${folderTitle}"? Nested folders will be removed and any whiteboards inside them will be moved to Root.`;
};

const useWhiteboardsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const canMoveWhiteboards = usePermission(['whiteboard:update']);
    const { currentFolderId, isInsideFolder, openFolder, goToRoot } = useFolderSearchParam();
    const { mutateAsync: deleteWhiteboard } = useDeleteWhiteboardMutation();
    const { mutateAsync: createWhiteboard } = useCreateWhiteboardMutation();
    const { mutateAsync: updateWhiteboard } = useUpdateWhiteboardMutation();
    const { mutateAsync: createWhiteboardFolder } = useCreateWhiteboardFolderMutation();
    const { mutateAsync: updateWhiteboardFolder } = useUpdateWhiteboardFolderMutation();
    const { mutateAsync: deleteWhiteboardFolder } = useDeleteWhiteboardFolderMutation();
    const { mutateAsync: moveWhiteboard } = useMoveWhiteboardMutation();
    const context = useMemo(() => ({ folderId: currentFolderId }), [currentFolderId]);

    const [renamingWhiteboard, setRenamingWhiteboard] = useState<Whiteboard | null>(null);
    const [renamingFolder, setRenamingFolder] = useState<WhiteboardFolder | null>(null);
    const [movingWhiteboard, setMovingWhiteboard] = useState<WhiteboardMoveTarget | null>(null);
    const [folderRefreshKey, setFolderRefreshKey] = useState(0);

    const { breadcrumbs, currentFolder } = useFolderBreadcrumbs<WhiteboardFolder>({
        currentFolderId,
        getFolder: fetchFolderById,
        onInvalidFolder: goToRoot,
        refreshKey: folderRefreshKey,
        invalidFolderMessage: 'This whiteboard folder no longer exists. Showing Root instead.'
    });

    const fetchData = useCallback(async (
        params: PaginationParams & WhiteboardsListingContext
    ): Promise<PaginatedResponse<WhiteboardListingRow>> => {
        if (!teamId) {
            return createEmptyWhiteboardsResponse(params);
        }

        try {
            const [whiteboardsResponse, foldersResponse] = await Promise.all([
                fetchWhiteboards(params),
                params.page === 1 ? fetchFolders(params.folderId ?? null) : Promise.resolve(null)
            ]);

            const folderRows = foldersResponse?.data.map(createWhiteboardFolderRow) ?? [];
            const whiteboardRows = (whiteboardsResponse.data || []).map(createWhiteboardItemRow);

            return {
                ...whiteboardsResponse,
                data: params.page === 1
                    ? [...folderRows, ...whiteboardRows]
                    : whiteboardRows
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
            (async () => {
                const whiteboard = await createWhiteboard({
                    teamId,
                    title: 'Untitled Whiteboard',
                    folderId: currentFolderId
                });

                await invalidateWhiteboardsQuery();
                navigate(`/dashboard/whiteboard/${whiteboard._id}`);
            })(),
            CREATE_WHITEBOARD_TOAST
        );
    }, [currentFolderId, createWhiteboard, navigate, teamId]);

    const handleCreateFolder = useCallback(async (title: string) => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createWhiteboardFolder({
                title,
                parentId: currentFolderId
            }).then(async () => {
                await Promise.all([
                    invalidateWhiteboardFoldersQuery(),
                    invalidateWhiteboardsQuery()
                ]);
            }),
            CREATE_FOLDER_TOAST
        );
    }, [createWhiteboardFolder, currentFolderId, teamId]);

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
        setRenamingFolder(folder);
        openModal(RENAME_WHITEBOARD_FOLDER_MODAL_ID);
    }, []);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(RENAME_WHITEBOARD_FOLDER_MODAL_ID);
        setRenamingFolder(null);
    }, []);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        if (!renamingFolder) {
            return;
        }

        await showPromise(
            updateWhiteboardFolder({
                folderId: renamingFolder._id,
                title
            }),
            RENAME_FOLDER_TOAST
        );

        setFolderRefreshKey((previousValue) => previousValue + 1);
        handleRenameFolderClose();
    }, [handleRenameFolderClose, renamingFolder, updateWhiteboardFolder]);

    const handleDeleteFolder = useCallback(async (folder: WhiteboardFolder) => {
        await runAction({
            action: () => deleteWhiteboardFolder({ folderId: folder._id }),
            confirm: {
                title: getDeleteFolderConfirmDescription(folder.title),
                description: 'Nested folders are deleted recursively. Whiteboards inside deleted folders are moved to Root.',
                confirmText: 'Delete Folder',
                cancelText: 'Cancel',
                tone: ConfirmActionTone.Danger
            },
            toast: DELETE_FOLDER_TOAST,
            afterSuccess: async () => {
                setFolderRefreshKey((previousValue) => previousValue + 1);

                if (currentFolderId === folder._id) {
                    if (folder.parent) {
                        openFolder(folder.parent);
                        return;
                    }

                    goToRoot();
                }
            }
        });
    }, [currentFolderId, deleteWhiteboardFolder, goToRoot, openFolder]);

    const handleMoveWhiteboardOpen = useCallback((whiteboard: Whiteboard) => {
        setMovingWhiteboard({
            _id: whiteboard._id,
            title: whiteboard.title,
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
        if (!isWhiteboardFolderRow(item)) {
            return false;
        }

        openFolder(item._id);
        return true;
    }, [openFolder]);

    const listMoveFolders = useCallback(async (folderId: string | null) => {
        const response = await fetchFolders(folderId);
        return response.data;
    }, []);

    const getMoveFolder = useCallback((folderId: string) => fetchFolderById(folderId), []);
    const navigateToFolder = useCallback((folderId: string | null) => {
        if (folderId) {
            openFolder(folderId);
            return;
        }

        goToRoot();
    }, [goToRoot, openFolder]);

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
        handleDeleteCurrentFolder: currentFolder ? () => handleDeleteFolder(currentFolder) : null,
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
