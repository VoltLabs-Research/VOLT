import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type ClusterTransferJob from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { ClusterTransferJobProps, ClusterTransferJobState } from '@modules/cluster/domain/entities/ClusterTransferJob';

export interface IClusterTransferJobRepository extends IBaseRepository<ClusterTransferJob, ClusterTransferJobProps> {
    findOpenByScope(
        scopeType: ClusterTransferJobProps['scopeType'],
        scopeId: string
    ): Promise<ClusterTransferJob | null>;
    findNextRunnable(): Promise<ClusterTransferJob | null>;
    listOpenByClusterIds(teamId: string, clusterIds: string[]): Promise<ClusterTransferJob[]>;
    claimNextRunnable(claimantId: string, ttlMs: number): Promise<ClusterTransferJob | null>;
    renewClaim(jobId: string, claimantId: string, ttlMs: number): Promise<boolean>;
    releaseClaim(jobId: string, claimantId: string): Promise<void>;
    updateRuntimeState(jobId: string, runtimeState: Record<string, unknown>): Promise<ClusterTransferJob | null>;
}
