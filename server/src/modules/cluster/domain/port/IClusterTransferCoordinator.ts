import type ClusterTransferJob from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { TransferRequestInput } from '@modules/cluster/application/services/ClusterTransferCoordinator';

export interface IClusterTransferCoordinator {
    requestTransfer(input: TransferRequestInput): Promise<ClusterTransferJob>;
    runPendingJobs(limit?: number): Promise<number>;
    planAutomaticRebalance(): Promise<number>;
    executeJob(jobId: string): Promise<ClusterTransferJob>;
}
