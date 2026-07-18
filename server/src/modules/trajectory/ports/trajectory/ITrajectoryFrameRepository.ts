import type { TrajectoryFrame } from '@modules/trajectory/entities/trajectory/Trajectory';

export interface GetFramesOptions {
    from?: number;
    to?: number;
    limit?: number;
    skip?: number;
}

export interface TrajectoryFrameListingSummary {
    framesCount: number;
    atoms: number;
    firstTimestep: number;
}

export interface ITrajectoryFrameRepository {
    getFrames(trajectoryId: string, options?: GetFramesOptions): Promise<TrajectoryFrame[]>;
    countFrames(trajectoryId: string): Promise<number>;
    getListingSummariesByTrajectoryIds(
        trajectoryIds: string[]
    ): Promise<Map<string, TrajectoryFrameListingSummary>>;
    insertFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void>;
    replaceFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void>;
    deleteByTrajectoryId(trajectoryId: string): Promise<number>;
    findFrame(trajectoryId: string, timestep: number): Promise<TrajectoryFrame | null>;
}
