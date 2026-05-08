import { extractTrajectoryTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
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
import { buildAtomsViewerPath } from '@/modules/trajectory/utilities/build-atoms-viewer-path';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { runAction } from '@/shared/presentation/actions/run-action';
import useFolderedListingDragAndDropMove from '@/shared/presentation/hooks/use-foldered-listing-drag-and-drop-move';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useFolderedListingMoveModal from '@/shared/presentation/hooks/use-foldered-listing-move-modal';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useRenameFolderModal from '@/shared/presentation/hooks/use-rename-folder-modal';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FOLDER_LIST_LIMIT, ROOT_FOLDER_ID } from '@/shared/presentation/constants/foldered-listing';
import { FolderInput, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { RiTableLine } from 'react-icons/ri';
import useTrajectoryFilePicker from './use-trajectory-file-picker';
import {
    trajectoryFolderQuery,
    trajectoryFoldersQuery,
    trajectoryQuery,
    useCreateTrajectoryFolderMutation,
    useDeleteTrajectoryFolderMutation,
    useMoveTrajectoryMutation,
    useUpdateTrajectoryFolderMutation
} from './queries';
import { useNavigate } from 'react-router-dom';
import { createEmptyPaginatedResponse } from '@/shared/domain/pagination';
export const NEW_TRAJECTORY_FOLDER_MODAL_ID = 'new-trajectory-folder-modal';
export const RENAME_TRAJECTORY_FOLDER_MODAL_ID = 'rename-trajectory-folder-modal';
export const MOVE_TRAJECTORY_MODAL_ID = 'move-trajectory-modal';

const DELETE_TRAJECTORY_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Trajectory' });
const CREATE_FOLDER_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Folder' });
const RENAME_FOLDER_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Folder' });
const DELETE_FOLDER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Folder' });
const MOVE_TRAJECTORY_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Trajectory' });

interface TrajectoryMoveTarget {
    _id: string;
    name: string;
    folder: string | null;
}

const getTrajectoryMoveTarget = (trajectory: Trajectory): TrajectoryMoveTarget => ({
    _id: trajectory._id,
    name: trajectory.name,
    folder: trajectory.folder
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

const buildDeleteTrajectoryMenuOption = (
    targets: Trajectory[],
    confirmDeletion: (targets: Trajectory[]) => Promise<void>
): MenuOption => {
    const label = targets.length === 1 ? 'Delete trajectory' : 'Delete trajectories';

    return {
        label,
        icon: Trash2,
        destructive: true,
        onClick: () => confirmDeletion(targets)
    };
};

const useTrajectoriesListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const canCreate = canAccess(['trajectory:create']);
    const canDeleteTrajectories = canAccess(['trajectory:delete']);
    const canMoveTrajectories = canAccess(['trajectory:update']);
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { mutateAsync: createFolder } = useCreateTrajectoryFolderMutation();
    const { mutateAsync: updateFolder } = useUpdateTrajectoryFolderMutation();
    const { mutateAsync: deleteFolder } = useDeleteTrajectoryFolderMutation();
    const { mutateAsync: moveTrajectory } = useMoveTrajectoryMutation();

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
        createEmptyResponse: createEmptyPaginatedResponse,
        mapFolderRow: createTrajectoryFolderRow,
        mapItemRow: createTrajectoryItemRow,
        onFetchErrorTitle: 'Failed to fetch trajectories',
        invalidFolderMessage: 'This trajectory folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: CREATE_FOLDER_TOAST,
        updateFolder,
        renameFolderToast: RENAME_FOLDER_TOAST,
        deleteFolder,
        deleteFolderToast: DELETE_FOLDER_TOAST,
        getDeleteFolderConfirm: (folder) => ({
            title: `Delete "${folder.title}"? Nested folders and all trajectories inside them will be deleted recursively.`,
            description: 'This permanently deletes the folder tree and every trajectory contained in it.'
        })
    });

    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(undefined, currentFolderId);

    const {
        handleRenameFolderOpen,
        handleRenameFolderClose,
        handleRenameFolderSubmit
    } = useRenameFolderModal({
        modalId: RENAME_TRAJECTORY_FOLDER_MODAL_ID,
        openRenameState: handleRenameFolderStateOpen,
        closeRenameState: handleRenameFolderStateClose,
        submitRenameState: handleRenameFolderStateSubmit
    });

    const handleCreate = useCallback(() => {
        openFilePicker();
    }, [openFilePicker]);

    const moveTrajectoryToFolder = useCallback((trajectoryId: string, folderId: string | null) => {
        return moveTrajectory({ trajectoryId, folderId });
    }, [moveTrajectory]);

    const {
        movingItem: movingTrajectory,
        handleMoveOpen: handleMoveTrajectoryOpen,
        handleMoveClose: handleMoveTrajectoryClose,
        handleMoveSubmit: handleMoveTrajectorySubmit
    } = useFolderedListingMoveModal<Trajectory, TrajectoryMoveTarget>({
        modalId: MOVE_TRAJECTORY_MODAL_ID,
        getMoveTarget: getTrajectoryMoveTarget,
        moveItem: moveTrajectoryToFolder,
        moveToast: MOVE_TRAJECTORY_TOAST
    });

    const handleDeleteTrajectories = useCallback(async (targets: Trajectory[]) => {
        const deleteLabel = targets.length === 1 ? 'Delete trajectory' : 'Delete trajectories';
        const isConfirmed = await confirm({
            title: targets.length === 1
                ? `Delete trajectory "${targets[0].name}"?`
                : `Delete ${targets.length} trajectories?`,
            description: 'This permanently deletes the selected trajectory data and cannot be undone.',
            confirmText: deleteLabel,
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        for (const trajectory of targets) {
            await runAction({
                action: () => deleteTrajectoryMutation.mutateAsync(trajectory._id),
                toast: DELETE_TRAJECTORY_TOAST
            });
        }
    }, [confirm, deleteTrajectoryMutation]);

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
                    const firstTimestep = trajectory.firstTimestep ?? extractTrajectoryTimesteps(trajectory)[0];
                    if (firstTimestep === undefined) {
                        return;
                    }
                    navigate(buildAtomsViewerPath({
                        trajectoryId: trajectory._id,
                        timestep: firstTimestep
                    }));
                },
                requiredPermission: 'trajectory:read'
            },
            move: {
                label: 'Move to Folder',
                icon: FolderInput,
                handler: ({ item: trajectory }) => handleMoveTrajectoryOpen(trajectory),
                requiredPermission: 'trajectory:update'
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
        const options = getTrajectoryMenuOptions(item, selectedTrajectories);

        if (!canDeleteTrajectories) {
            return options;
        }

        const deleteTargets = selectedTrajectories.length > 0 ? selectedTrajectories : [item];

        return [
            ...options,
            buildDeleteTrajectoryMenuOption(deleteTargets, handleDeleteTrajectories)
        ];
    }, [canDeleteTrajectories, getFolderMenuOptions, getTrajectoryMenuOptions, handleDeleteTrajectories]);

    const handleItemClick = useCallback((item: TrajectoryListingRow): boolean => {
        if (isTrajectoryFolderRow(item)) {
            openFolder(item._id);
            return true;
        }

        navigate(`/canvas/${item._id}`);
        return true;
    }, [navigate, openFolder]);

    const dragAndDrop = useFolderedListingDragAndDropMove({
        canMove: canMoveTrajectories,
        activationDistance: 8,
        getDraggableId: getTrajectoryListingDraggableId,
        getDroppableId: getTrajectoryListingDroppableId,
        isItemRow: isTrajectoryItemRow,
        isFolderRow: isTrajectoryFolderRow,
        moveItem: moveTrajectoryToFolder,
        moveToast: MOVE_TRAJECTORY_TOAST
    });

    return {
        breadcrumbs,
        canCreate,
        context,
        currentFolder,
        currentFolderId,
        dragAndDrop,
        fetchData,
        fileInputRef,
        getMenuOptions,
        getMoveFolder,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveTrajectoryOpen,
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
        openFolder,
        queryKey: trajectoryQuery.QUERY_KEYS.lists(),
        renamingFolder
    };
};

export default useTrajectoriesListing;
