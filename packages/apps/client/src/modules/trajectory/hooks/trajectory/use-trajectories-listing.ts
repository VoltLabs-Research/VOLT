import { extractTrajectoryTimesteps } from '@/modules/canvas/utils/selected-timestep-analysis';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import {
    createTrajectoryFolderRow,
    createTrajectoryItemRow,
    getTrajectoryListingDraggableId,
    getTrajectoryListingDroppableId,
    isTrajectoryFolderRow,
    isTrajectoryItemRow,
    resolveTrajectoryListingDroppableFolderId
} from '@/modules/trajectory/utils/listing';
import type { TrajectoryFolderRow, TrajectoryItemRow } from '@/modules/trajectory/contracts/listing';
import { buildAtomsViewerPath } from '@/modules/trajectory/utils/build-atoms-viewer-path';
import { isTrajectoryNavigable } from '@/modules/trajectory/utils/trajectory-status';
import { SOCKET_TRAJECTORY_EVENTS } from '@/modules/socket/events/trajectory';
import useTeamAccess from '@/modules/team/hooks/team/use-team-access';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import { runAction } from '@/shared/ui/actions/run-action';
import useFolderedResourceListing from '@/shared/ui/hooks/use-foldered-resource-listing';
import { createFolderedListingResource } from '@/shared/ui/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/ui/hooks/use-listing-actions';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import type { MenuOption } from '@/shared/contracts/menu';
import { Download, FolderInput, Table, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import useTrajectoryFilePicker from './use-trajectory-file-picker';
import useDownloadTrajectory from './use-download-trajectory';
import {
    TRAJECTORY_FOLDERS_QUERY_KEY,
    trajectoryFolderQuery,
    trajectoryFoldersQuery,
    trajectoryQuery,
    useCreateTrajectoryFolderMutation,
    useDeleteTrajectoryFolderMutation,
    useMoveTrajectoryMutation,
    useUpdateTrajectoryFolderMutation
} from './queries';
import { useNavigate } from 'react-router-dom';
import { TeamAccess, TeamArea } from '@volt/contracts/modules/team/access';
import { readAccess, writeAccess } from '@/modules/team/utils/team/team-access';

export const trajectoriesListingResource = createFolderedListingResource({
    subject: 'Trajectory',
    singularName: 'trajectory',
    pluralName: 'trajectories',
    area: TeamArea.Trajectory,
    listItems: trajectoryQuery.useListQuery.fetch,
    listFolders: trajectoryFoldersQuery.fetch,
    getFolder: trajectoryFolderQuery.fetch
});

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    {
        event: SOCKET_TRAJECTORY_EVENTS.CREATED,
        queryKeys: [TRAJECTORY_FOLDERS_QUERY_KEY, trajectoryQuery.QUERY_KEYS.lists()]
    },
    {
        event: SOCKET_TRAJECTORY_EVENTS.UPDATED,
        queryKeys: [TRAJECTORY_FOLDERS_QUERY_KEY, trajectoryQuery.QUERY_KEYS.lists()]
    },
    {
        event: SOCKET_TRAJECTORY_EVENTS.DELETED,
        queryKeys: [TRAJECTORY_FOLDERS_QUERY_KEY, trajectoryQuery.QUERY_KEYS.lists()]
    }
];

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

interface UseTrajectoriesListingOptions {
    onRenameFolder?: (folder: TrajectoryFolderRow) => void;
}

const useTrajectoriesListing = ({ onRenameFolder }: UseTrajectoriesListingOptions = {}) => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { can } = useTeamAccess();
    const canCreate = can(TeamArea.Trajectory, TeamAccess.Write);
    const canDeleteTrajectories = can(TeamArea.Trajectory, TeamAccess.Write);
    const canMoveTrajectories = can(TeamArea.Trajectory, TeamAccess.Write);
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { mutateAsync: createFolder } = useCreateTrajectoryFolderMutation();
    const { mutateAsync: updateFolder } = useUpdateTrajectoryFolderMutation();
    const { mutateAsync: deleteFolder } = useDeleteTrajectoryFolderMutation();
    const { mutateAsync: moveTrajectory } = useMoveTrajectoryMutation();
    const { downloadTrajectory } = useDownloadTrajectory();

    const moveTrajectoryToFolder = useCallback((trajectoryId: string, folderId: string | null) => {
        return moveTrajectory({
            trajectoryId,
            folderId
        });
    }, [moveTrajectory]);

    const openTrajectory = useCallback((trajectory: Trajectory) => {
        if (!isTrajectoryNavigable(trajectory.status)) {
            return;
        }
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
                toast: trajectoriesListingResource.toasts.delete
            });
        }
    }, [deleteTrajectoryMutation]);

    const getTrajectoryActions = useCallback(({ openMove }: { openMove: (trajectory: TrajectoryItemRow) => void }): Record<string, ActionConfig<TrajectoryItemRow>> => ({
        view: {
            label: 'View Scene',
            handler: ({ item: trajectory }) => openTrajectory(trajectory),
            requiredAccess: readAccess(TeamArea.Trajectory)
        },
        viewAtoms: {
            label: 'Inspect Atoms',
            icon: Table,
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
            requiredAccess: readAccess(TeamArea.Trajectory)
        },
        export: {
            label: 'Export',
            icon: Download,
            handler: ({ item: trajectory }) => downloadTrajectory({
                trajectoryId: trajectory._id,
                filename: trajectory.name || trajectory._id,
                archive: true
            }),
            requiredAccess: readAccess(TeamArea.Trajectory)
        },
        move: {
            label: 'Move to Folder',
            icon: FolderInput,
            handler: ({ item: trajectory }) => openMove(trajectory),
            requiredAccess: writeAccess(TeamArea.Trajectory)
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

    const folderedListing = useFolderedResourceListing({
        teamId,
        ...trajectoriesListingResource.listingOptions,
        mapFolderRow: createTrajectoryFolderRow,
        mapItemRow: createTrajectoryItemRow,
        createFolder,
        updateFolder,
        deleteFolder,
        canMoveItems: canMoveTrajectories,
        activationDistance: 8,
        getDraggableId: getTrajectoryListingDraggableId,
        getDroppableId: getTrajectoryListingDroppableId,
        isItemRow: isTrajectoryItemRow,
        isFolderRow: isTrajectoryFolderRow,
        moveItem: moveTrajectoryToFolder,
        getMoveFolderIdFromDroppableId: resolveTrajectoryListingDroppableFolderId,
        getItemActions: getTrajectoryActions,
        mapItemMenuOptions: appendTrajectoryDeleteOption,
        onOpenItem: openTrajectory,
        onRenameFolder
    });

    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(
        undefined,
        folderedListing.currentFolderId
    );

    return {
        ...folderedListing,
        canCreate,
        fileInputRef,
        handleCreate: openFilePicker,
        handlePickerChange,
        isUploading,
        queryKey: trajectoryQuery.QUERY_KEYS.lists(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useTrajectoriesListing;
