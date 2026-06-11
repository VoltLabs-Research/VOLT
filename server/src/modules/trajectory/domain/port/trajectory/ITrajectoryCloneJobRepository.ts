import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type TrajectoryCloneJob from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import type { TrajectoryCloneJobProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';

export interface ITrajectoryCloneJobRepository extends IBaseRepository<TrajectoryCloneJob, TrajectoryCloneJobProps> {
    findOpenByDestinationTrajectoryId(trajectoryId: string): Promise<TrajectoryCloneJob | null>;
    claimNextRunnable(workerId: string, claimTtlMs: number): Promise<TrajectoryCloneJob | null>;
    renewClaim(jobId: string, workerId: string, claimTtlMs: number): Promise<boolean>;
    releaseClaim(jobId: string, workerId: string): Promise<void>;
    updateRuntimeState(jobId: string, data: Partial<TrajectoryCloneJobProps>): Promise<TrajectoryCloneJob | null>;
}
