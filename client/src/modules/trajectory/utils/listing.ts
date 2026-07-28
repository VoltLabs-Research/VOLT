import type { Trajectory, TrajectoryFolder } from '@volt/contracts/modules/trajectory/domain';
import type { TrajectoryFolderRowExtras } from '@/modules/trajectory/contracts/listing';
import { createFolderedListingRows } from '@/shared/ui/utils/foldered-listing-rows';

export const {
    mapFolderRow: createTrajectoryFolderRow,
    mapItemRow: createTrajectoryItemRow,
    isFolderRow: isTrajectoryFolderRow,
    isItemRow: isTrajectoryItemRow,
    getDraggableId: getTrajectoryListingDraggableId,
    getDroppableId: getTrajectoryListingDroppableId,
    getFolderDroppableId: getTrajectoryListingFolderDroppableId,
    resolveDroppableFolderId: resolveTrajectoryListingDroppableFolderId
} = createFolderedListingRows<TrajectoryFolder, Trajectory, TrajectoryFolderRowExtras>({
    folderExtras: (folder) => ({
        name: folder.title,
        team: '',
        analysis: [],
        frames: [],
        stats: {
            totalFiles: 0,
            totalSize: 0
        },
        users: [],
        folder: folder.parent,
        status: 'folder',
        isPublic: false,
        teamCluster: null
    })
});
