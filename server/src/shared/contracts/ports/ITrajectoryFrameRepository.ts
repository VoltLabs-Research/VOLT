/**
 * Neutral, standalone repository-port contract for trajectory frames.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). This is a
 * STANDALONE copy of `ITrajectoryFrameRepository` owned by
 * `@modules/trajectory/domain/port/trajectory/ITrajectoryFrameRepository`,
 * exported here so cross-module consumers can inject the frame repository
 * without importing the trajectory module. The `TrajectoryFrame` shape is taken
 * from the neutral `@shared/contracts/types/Trajectory` copy.
 *
 * No `@modules/*` imports — pure type declarations only.
 */
import type { TrajectoryFrame } from '@shared/contracts/types/Trajectory';

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
