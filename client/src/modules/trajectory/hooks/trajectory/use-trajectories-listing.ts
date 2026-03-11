import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { TrajectoryFolder } from '@/modules/trajectory/api/entities/trajectory/trajectory-folder';
import {
    createTrajectoryFolderRow,
    createTrajectoryItemRow,
    getTrajectoryListingDraggableId,
    getTrajectoryListingDroppableId,
    isTrajectoryFolderRow,
    isTrajectoryItemRow,
    type TrajectoryListingRow
} from '@/modules/trajectory/utilities/listing';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { runAction } from '@/shared/presentation/actions/run-action';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createPromiseToastOptions, type PromiseToastOptions } from '@/shared/presentation/toast-options';
import queryClient from '@/shared/infrastructure/query/query-client';
import { FolderInput, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiTableLine } from 'react-icons/ri';
import useTrajectoryFilePicker from './use-trajectory-file-picker';
import {
    invalidateTrajectoryFoldersQuery,
    trajectoryFolderQuery,
    trajectoryFoldersQuery,
    trajectoryQuery,
    useCreateTrajectoryFolderMutation,
    useDeleteTrajectoryFolderMutation,
    useMoveTrajectoryMutation,
    useUpdateTrajectoryFolderMutation
} from './queries';

const ROOT_FOLDER_ID = 'root';
const FOLDER_LIST_LIMIT = 500;

export const NEW_TRAJECTORY_FOLDER_MODAL_ID = 'new-trajectory-folder-modal';
export const RENAME_TRAJECTORY_FOLDER_MODAL_ID = 'rename-trajectory-folder-modal';
export const MOVE_TRAJECTORY_MODAL_ID = 'move-trajectory-modal';

const DELETE_TRAJECTORY_TOAST: PromiseToastOptions = createPromiseToastOptions({
    loading: 'Deleting trajectory...',
    success: 'Trajectory deleted',
    error: 'Failed to delete trajectory'
});

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'trajectory.created', queryKeys: [trajectoryQuery.QUERY_KEYS.lists()] },
    { event: 'trajectory.deleted', queryKeys: [trajectoryQuery.QUERY_KEYS.lists()] },
    { event: 'trajectory.updated', queryKeys: [trajectoryQuery.QUERY_KEYS.lists()] }
];

interface TrajectoryMoveTarget {
    _id: string;
    name: string;
    folder: string | null;
}

const createEmptyResponse = <T extends { _id: string }>(params: PaginationParams): PaginatedResponse<T> => ({
    status: 'success',
    data: [],
    pagination: {
        page: Math.max(1, Number(params.page) || 1),
        limit: Math.max(1, Number(params.limit) || 20),
        total: 0,
        totalPages: 1,
        hasMore: false
    }
});

const fetchTrajectories = (params: PaginationParams & FolderedListingContext): Promise<PaginatedResponse<Trajectory>> => {
    return trajectoryQuery.useListQuery.fetch({
        page: params.page,
        limit: params.limit,
        folderId: params.folderId ?? ROOT_FOLDER_ID,
        ...(params.search ? { search: params.search } : {})
    });
};

const fetchFolders = (folderId: string | null): Promise<PaginatedResponse<TrajectoryFolder>> => {
    return trajectoryFoldersQuery.fetch({
        page: 1,
        limit: FOLDER_LIST_LIMIT,
        ...(folderId ? { parentId: folderId } : {})
    });
};

const fetchFolderById = (folderId: string): Promise<TrajectoryFolder> => {
    return trajectoryFolderQuery.fetch({ folderId });
};

const useTrajectoriesListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const canCreate = usePermission(['trajectory:create']);
    const canMoveTrajectories = usePermission(['trajectory:update']);
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { mutateAsync: createFolder } = useCreateTrajectoryFolderMutation();
    const { mutateAsync: updateFolder } = useUpdateTrajectoryFolderMutation();
    const { mutateAsync: deleteFolder } = useDeleteTrajectoryFolderMutation();
    const { mutateAsync: moveTrajectory } = useMoveTrajectoryMutation();

    const [movingTrajectory, setMovingTrajectory] = useState<TrajectoryMoveTarget | null>(null);

    const {
        breadcrumbs,
        context,
        currentFolder,
        fetchData,
        getMoveFolder,
        currentFolderId,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleDeleteFolder,
        handleRenameFolderClose: handleRenameFolderStateClose,
        handleRenameFolderOpen: handleRenameFolderStateOpen,
        handleRenameFolderSubmit: handleRenameFolderStateSubmit,
        listMoveFolders,
        navigateToFolder,
        openFolder,
        renamingFolder
    } = useFolderedListing<Trajectory, TrajectoryFolder, TrajectoryListingRow>({
        teamId,
        fetchItems: fetchTrajectories,
        fetchFolders,
        getFolder: fetchFolderById,
        createEmptyResponse,
        mapFolderRow: createTrajectoryFolderRow,
        mapItemRow: createTrajectoryItemRow,
        onFetchErrorTitle: 'Failed to fetch trajectories',
        invalidFolderMessage: 'This trajectory folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: {
            loading: { title: 'Creating folder...' },
            success: { title: 'Folder created successfully' },
            error: { title: 'Failed to create folder' }
        },
        afterCreateFolder: async () => {
            await Promise.all([
                invalidateTrajectoryFoldersQuery(),
                queryClient.invalidateQueries({ queryKey: trajectoryQuery.QUERY_KEYS.lists() })
            ]);
        },
        updateFolder,
        renameFolderToast: {
            loading: { title: 'Renaming folder...' },
            success: { title: 'Folder renamed successfully' },
            error: { title: 'Failed to rename folder' }
        },
        deleteFolder,
        deleteFolderToast: {
            loading: { title: 'Deleting folder...' },
            success: { title: 'Folder deleted successfully' },
            error: { title: 'Failed to delete folder' }
        },
        getDeleteFolderConfirm: (folder) => ({
            title: `Delete "${folder.title}"? Nested folders and all trajectories inside them will be deleted recursively.`,
            description: 'This permanently deletes the folder tree and every trajectory contained in it.'
        })
    });

    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(undefined, currentFolderId);

    const handleRenameFolderOpen = useCallback((folder: TrajectoryFolder) => {
        handleRenameFolderStateOpen(folder);
        openModal(RENAME_TRAJECTORY_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateOpen]);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(RENAME_TRAJECTORY_FOLDER_MODAL_ID);
        handleRenameFolderStateClose();
    }, [handleRenameFolderStateClose]);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        await handleRenameFolderStateSubmit(title);
        closeModal(RENAME_TRAJECTORY_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateSubmit]);

    const handleCreate = useCallback(() => {
        openFilePicker();
    }, [openFilePicker]);

    const handleMoveTrajectoryOpen = useCallback((trajectory: Trajectory) => {
        setMovingTrajectory({
            _id: trajectory._id,
            name: trajectory.name,
            folder: trajectory.folder
        });
        openModal(MOVE_TRAJECTORY_MODAL_ID);
    }, []);

    const handleMoveTrajectoryClose = useCallback(() => {
        closeModal(MOVE_TRAJECTORY_MODAL_ID);
        setMovingTrajectory(null);
    }, []);

    const handleMoveTrajectorySubmit = useCallback(async (folderId: string | null) => {
        if (!movingTrajectory) {
            return;
        }

        await showPromise(moveTrajectory({ trajectoryId: movingTrajectory._id, folderId }), {
            loading: { title: 'Moving trajectory...' },
            success: { title: 'Trajectory moved successfully' },
            error: { title: 'Failed to move trajectory' }
        });
    }, [moveTrajectory, movingTrajectory]);

    const handleTrajectoryRowDragEnd = useCallback(async (
        payload: Parameters<DocumentListingDragAndDropConfig<TrajectoryListingRow>['onDragEnd']>[0]
    ) => {
        const { activeItem, overItem } = payload;
        if (!activeItem || !overItem || !isTrajectoryItemRow(activeItem) || !isTrajectoryFolderRow(overItem)) {
            return;
        }

        if (activeItem.folder === overItem._id) {
            return;
        }

        await showPromise(moveTrajectory({ trajectoryId: activeItem._id, folderId: overItem._id }), {
            loading: { title: 'Moving trajectory...' },
            success: { title: 'Trajectory moved successfully' },
            error: { title: 'Failed to move trajectory' }
        });
    }, [moveTrajectory]);

    const { getMenuOptions: getTrajectoryMenuOptions } = useListingActions<Trajectory>({
        actions: {
            view: {
                label: 'View Scene',
                handler: ({ item: trajectory }) => navigate(`/canvas/${trajectory._id}`),
                requiredPermission: 'trajectory:read'
            },
            viewAtoms: {
                label: 'Inspect Atoms',
                icon: RiTableLine,
                handler: ({ item: trajectory }) => {
                    const firstTimestep = trajectory.frames[0]?.timestep;
                    if (firstTimestep === undefined) {
                        return;
                    }
                    navigate(`/dashboard/trajectory/${trajectory._id}/analysis/default/atoms/default?timestep=${firstTimestep}`);
                },
                requiredPermission: 'trajectory:read'
            },
            move: {
                label: 'Move to Folder',
                icon: FolderInput,
                handler: ({ item: trajectory }) => handleMoveTrajectoryOpen(trajectory),
                requiredPermission: 'trajectory:update'
            },
            delete: {
                handler: async ({ item: trajectory }) => {
                    await runAction({
                        action: () => deleteTrajectoryMutation.mutateAsync(trajectory._id),
                        toast: DELETE_TRAJECTORY_TOAST
                    });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete trajectory "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} trajectories? This action cannot be undone.`
                ),
                requiredPermission: 'trajectory:delete'
            }
        }
    });

    const { getMenuOptions: getFolderMenuOptions } = useListingActions<TrajectoryFolder>({
        actions: {
            open: {
                label: 'Open Folder',
                icon: FolderOpen,
                handler: ({ item }) => openFolder(item._id)
            },
            rename: {
                label: 'Rename Folder',
                icon: Pencil,
                handler: ({ item }) => handleRenameFolderOpen(item),
                requiredPermission: 'trajectory:update'
            },
            delete: {
                label: 'Delete Folder',
                icon: Trash2,
                variant: 'danger',
                handler: async ({ item }) => handleDeleteFolder(item),
                requiredPermission: 'trajectory:delete'
            }
        }
    });

    const getMenuOptions = useCallback((item: TrajectoryListingRow, selectedItems: TrajectoryListingRow[]): MenuOption[] => {
        if (isTrajectoryFolderRow(item)) {
            return getFolderMenuOptions(item, [item]);
        }

        const selectedTrajectories = selectedItems.filter(isTrajectoryItemRow);
        return getTrajectoryMenuOptions(item, selectedTrajectories);
    }, [getFolderMenuOptions, getTrajectoryMenuOptions]);

    const handleItemClick = useCallback((item: TrajectoryListingRow): boolean => {
        if (!isTrajectoryFolderRow(item)) {
            return false;
        }

        openFolder(item._id);
        return true;
    }, [openFolder]);

    const dragAndDrop = useMemo<DocumentListingDragAndDropConfig<TrajectoryListingRow> | undefined>(() => {
        if (!canMoveTrajectories) {
            return undefined;
        }

        return {
            activationDistance: 6,
            getDraggableId: getTrajectoryListingDraggableId,
            getDroppableId: getTrajectoryListingDroppableId,
            onDragEnd: handleTrajectoryRowDragEnd
        };
    }, [canMoveTrajectories, handleTrajectoryRowDragEnd]);

    return {
        breadcrumbs,
        canCreate,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        fileInputRef,
        getMenuOptions,
        getMoveFolder,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveTrajectoryClose,
        handleMoveTrajectorySubmit,
        handlePickerChange,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        isUploading,
        listMoveFolders,
        movingTrajectory,
        navigateToFolder,
        queryKey: trajectoryQuery.QUERY_KEYS.lists(),
        renamingFolder,
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useTrajectoriesListing;
