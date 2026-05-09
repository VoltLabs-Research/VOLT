import { extractTrajectoryTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import {
    createTrajectoryFolderRow,
    createTrajectoryItemRow,
    getTrajectoryListingDraggableId,
    getTrajectoryListingDroppableId,
    isTrajectoryFolderRow,
    isTrajectoryItemRow,
    resolveTrajectoryListingDroppableFolderId,
    type TrajectoryItemRow
} from '@/modules/trajectory/utilities/listing';
import { buildAtomsViewerPath } from '@/modules/trajectory/utilities/build-atoms-viewer-path';
import { SOCKET_TRAJECTORY_EVENTS } from '@/modules/socket/events/trajectory';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import { runAction } from '@/shared/presentation/actions/run-action';
import useFolderedResourceListing from '@/shared/presentation/hooks/use-foldered-resource-listing';
import {
    createFolderedResourceFetchers,
    createFolderResourceDeleteConfirm,
    FOLDER_RESOURCE_TOASTS
} from '@/shared/presentation/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/presentation/hooks/use-listing-actions';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { Download, FolderInput, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { RiTableLine } from 'react-icons/ri';
import useTrajectoryFilePicker from './use-trajectory-file-picker';
import useDownloadTrajectory from './use-download-trajectory';
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
export const NEW_TRAJECTORY_FOLDER_MODAL_ID = 'new-trajectory-folder-modal';
export const RENAME_TRAJECTORY_FOLDER_MODAL_ID = 'rename-trajectory-folder-modal';
export const MOVE_TRAJECTORY_MODAL_ID = 'move-trajectory-modal';

const DELETE_TRAJECTORY_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Trajectory' });
const MOVE_TRAJECTORY_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Trajectory' });

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_TRAJECTORY_EVENTS.CREATED, queryKeys: [trajectoryQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_TRAJECTORY_EVENTS.UPDATED, queryKeys: [trajectoryQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_TRAJECTORY_EVENTS.DELETED, queryKeys: [trajectoryQuery.QUERY_KEYS.lists()] }
];

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

const trajectoryFetchers = createFolderedResourceFetchers({
    listItems: trajectoryQuery.useListQuery.fetch,
    listFolders: trajectoryFoldersQuery.fetch,
    getFolder: trajectoryFolderQuery.fetch
});

const getDeleteFolderConfirm = createFolderResourceDeleteConfirm({
    pluralName: 'trajectories',
    singularName: 'trajectory'
});

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
    const { downloadTrajectory } = useDownloadTrajectory();

    const moveTrajectoryToFolder = useCallback((trajectoryId: string, folderId: string | null) => {
        return moveTrajectory({ trajectoryId, folderId });
    }, [moveTrajectory]);

    const openTrajectory = useCallback((trajectory: Trajectory) => {
        navigate(`/canvas/${trajectory._id}`);
    }, [navigate]);

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

    const getTrajectoryActions = useCallback(({ openMove }: { openMove: (trajectory: TrajectoryItemRow) => void }): Record<string, ActionConfig<TrajectoryItemRow>> => ({
        view: {
            label: 'View Scene',
            handler: ({ item: trajectory }) => openTrajectory(trajectory),
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
        export: {
            label: 'Export',
            icon: Download,
            handler: ({ item: trajectory }) => downloadTrajectory({
                trajectoryId: trajectory._id,
                filename: trajectory.name || trajectory._id,
                archive: true
            }),
            requiredPermission: 'trajectory:read'
        },
        move: {
            label: 'Move to Folder',
            icon: FolderInput,
            handler: ({ item: trajectory }) => openMove(trajectory),
            requiredPermission: 'trajectory:update'
        }
    }), [downloadTrajectory, navigate, openTrajectory]);

    const appendTrajectoryDeleteOption = useCallback((options: MenuOption[], {
        item,
        selectedItems
    }: {
        item: TrajectoryItemRow;
        selectedItems: TrajectoryItemRow[];
    }): MenuOption[] => {
        if (!canDeleteTrajectories) {
            return options;
        }

        return [
            ...options,
            buildDeleteTrajectoryMenuOption(selectedItems.length > 0 ? selectedItems : [item], handleDeleteTrajectories)
        ];
    }, [canDeleteTrajectories, handleDeleteTrajectories]);

    const {
        handleMoveOpen,
        handleMoveClose,
        handleMoveSubmit,
        movingItem,
        ...folderedListing
    } = useFolderedResourceListing({
        teamId,
        ...trajectoryFetchers,
        mapFolderRow: createTrajectoryFolderRow,
        mapItemRow: createTrajectoryItemRow,
        onFetchErrorTitle: 'Failed to fetch trajectories',
        invalidFolderMessage: 'This trajectory folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: FOLDER_RESOURCE_TOASTS.create,
        updateFolder,
        renameFolderToast: FOLDER_RESOURCE_TOASTS.rename,
        deleteFolder,
        deleteFolderToast: FOLDER_RESOURCE_TOASTS.delete,
        getDeleteFolderConfirm,
        renameFolderModalId: RENAME_TRAJECTORY_FOLDER_MODAL_ID,
        moveModalId: MOVE_TRAJECTORY_MODAL_ID,
        canMoveItems: canMoveTrajectories,
        activationDistance: 8,
        getDraggableId: getTrajectoryListingDraggableId,
        getDroppableId: getTrajectoryListingDroppableId,
        isItemRow: isTrajectoryItemRow,
        isFolderRow: isTrajectoryFolderRow,
        getMoveTarget: getTrajectoryMoveTarget,
        moveItem: moveTrajectoryToFolder,
        getMoveFolderIdFromDroppableId: resolveTrajectoryListingDroppableFolderId,
        moveToast: MOVE_TRAJECTORY_TOAST,
        folderPermissions: {
            rename: 'trajectory:update',
            delete: 'trajectory:delete'
        },
        getItemActions: getTrajectoryActions,
        mapItemMenuOptions: appendTrajectoryDeleteOption,
        onOpenItem: openTrajectory
    });

    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(
        undefined,
        folderedListing.currentFolderId
    );

    const handleCreate = useCallback(() => {
        openFilePicker();
    }, [openFilePicker]);

    return {
        ...folderedListing,
        canCreate,
        fileInputRef,
        handleCreate,
        handleMoveTrajectoryOpen: handleMoveOpen,
        handleMoveTrajectoryClose: handleMoveClose,
        handleMoveTrajectorySubmit: handleMoveSubmit,
        handlePickerChange,
        isUploading,
        movingTrajectory: movingItem,
        queryKey: trajectoryQuery.QUERY_KEYS.lists(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useTrajectoriesListing;
