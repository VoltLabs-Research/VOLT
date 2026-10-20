export enum TrajectoryCloneJobState{
    Queued = 'queued',
    Preparing = 'preparing',
    Copying = 'copying',
    Completed = 'completed',
    Failed = 'failed'
}

export interface TrajectoryCloneJobStats{
    totalFrames: number;
    copiedFrames: number;
    copiedBytes: number;
}

export const createTrajectoryCloneJobStats = (stats: Partial<TrajectoryCloneJobStats> = {}): TrajectoryCloneJobStats => ({
    totalFrames: stats.totalFrames ?? 0,
    copiedFrames: stats.copiedFrames ?? 0,
    copiedBytes: stats.copiedBytes ?? 0
});
