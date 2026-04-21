import type { TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface GetFramesOptions {
    from?: number;
    to?: number;
    limit?: number;
    skip?: number;
}

/**
 * Access port for the dedicated `trajectoryframes` collection.
 *
 * The embedded `frames[]` array on Trajectory was split out in migration
 * 2026-04-extract-frames so a single trajectory document stays under 1 MB and
 * frame writes no longer serialize through the parent document's write lock.
 */
export interface ITrajectoryFrameRepository {
    getFrames(trajectoryId: string, options?: GetFramesOptions): Promise<TrajectoryFrame[]>;
    countFrames(trajectoryId: string): Promise<number>;
    insertFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void>;
    replaceFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void>;
    deleteByTrajectoryId(trajectoryId: string): Promise<number>;
    findFrame(trajectoryId: string, timestep: number): Promise<TrajectoryFrame | null>;
}
