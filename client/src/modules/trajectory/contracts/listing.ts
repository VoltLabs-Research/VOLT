import type { Trajectory, TrajectoryFolder } from '@volt/contracts/modules/trajectory/domain';
import type { FolderedFolderRow, FolderedItemRow, FolderedListingRow } from '@/shared/ui/utils/foldered-listing-rows';

export interface TrajectoryFolderRowStats {
    totalFiles: number;
    totalSize: number;
}

export interface TrajectoryFolderRowExtras {
    name: string;
    team: string;
    analysis: [];
    frames: [];
    stats: TrajectoryFolderRowStats;
    users: [];
    folder: string | null;
    status: 'folder';
    isPublic: false;
    teamCluster: null;
}

export type TrajectoryFolderRow = FolderedFolderRow<TrajectoryFolder, TrajectoryFolderRowExtras>;

export type TrajectoryItemRow = FolderedItemRow<Trajectory>;

export type TrajectoryListingRow = FolderedListingRow<TrajectoryFolder, Trajectory, TrajectoryFolderRowExtras>;
