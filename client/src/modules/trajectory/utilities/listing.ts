import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { TrajectoryFolder } from '@/modules/trajectory/api/entities/trajectory/trajectory-folder';

export enum TrajectoryListingRowType {
    Folder = 'folder',
    Trajectory = 'trajectory'
}

enum TrajectoryListingDndPrefix {
    Folder = 'folder',
    Trajectory = 'trajectory'
}

export interface TrajectoryFolderRow extends TrajectoryFolder {
    rowType: TrajectoryListingRowType.Folder;
    name: string;
    team: string;
    analysis: [];
    frames: [];
    stats: {
        totalFiles: number;
        totalSize: number;
    };
    users: [];
    folder: string | null;
    status: 'folder';
    isPublic: false;
    teamCluster: null;
}

export interface TrajectoryItemRow extends Trajectory {
    rowType: TrajectoryListingRowType.Trajectory;
}

export type TrajectoryListingRow = TrajectoryFolderRow | TrajectoryItemRow;

export const createTrajectoryFolderRow = (folder: TrajectoryFolder): TrajectoryFolderRow => ({
    ...folder,
    rowType: TrajectoryListingRowType.Folder,
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
});

export const createTrajectoryItemRow = (trajectory: Trajectory): TrajectoryItemRow => ({
    ...trajectory,
    rowType: TrajectoryListingRowType.Trajectory
});

export const isTrajectoryFolderRow = (row: TrajectoryListingRow): row is TrajectoryFolderRow => row.rowType === TrajectoryListingRowType.Folder;
export const isTrajectoryItemRow = (row: TrajectoryListingRow): row is TrajectoryItemRow => row.rowType === TrajectoryListingRowType.Trajectory;

export const getTrajectoryListingDraggableId = (row: TrajectoryListingRow): string | null => {
    if (!isTrajectoryItemRow(row)) {
        return null;
    }

    return `${TrajectoryListingDndPrefix.Trajectory}:${row._id}`;
};

export const getTrajectoryListingDroppableId = (row: TrajectoryListingRow): string | null => {
    if (!isTrajectoryFolderRow(row)) {
        return null;
    }

    return `${TrajectoryListingDndPrefix.Folder}:${row._id}`;
};
