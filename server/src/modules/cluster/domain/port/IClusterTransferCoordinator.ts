import type ClusterTransferJob from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { ClusterTransferJobReason } from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { StoragePlacementScopeType } from '@shared/domain/contracts/team-cluster';

export interface TransferRequestInput {
    teamId: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    destinationClusterId: string;
    requestedBy: string;
    reason?: ClusterTransferJobReason;
}

export interface IClusterTransferCoordinator {
    requestTransfer(input: TransferRequestInput): Promise<ClusterTransferJob>;
    runPendingJobs(limit?: number): Promise<number>;
    planAutomaticRebalance(): Promise<number>;
    executeJob(jobId: string): Promise<ClusterTransferJob>;
}
