import { ErrorCodes } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';

import DaemonListingReplicator from '@modules/cluster/services/daemon/DaemonListingReplicator';
import ClusterRebalancePlanner from '@modules/cluster/services/transfer/ClusterRebalancePlanner';
import ClusterTransferJobStore from '@modules/cluster/services/transfer/ClusterTransferJobStore';
import publishTransferJobProjection from '@modules/cluster/services/transfer/ClusterTransferJobProjector';
import ClusterTransferObjectCopier from '@modules/cluster/services/transfer/ClusterTransferObjectCopier';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import {
    describeClusterTransferJob,
    type ClusterTransferJob
} from '@modules/cluster/contracts/cluster-transfer-job';
import type {
    ClusterTransferJobReason
} from '@volt/contracts/modules/cluster/domain';
import type { StoragePlacement } from '@modules/cluster/contracts/storage-placement';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import { HARD_STORAGE_LIMIT_PCT } from '@shared/application/utilities/cluster-storage-policy';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    StoragePlacementScopeType,
    StoragePlacementState
} from '@shared/domain/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import {
    CLUSTER_TRANSFER_CLAIM_RENEW_INTERVAL_MS,
    CLUSTER_TRANSFER_CLAIM_TTL_MS,
    isOpenTransferJobState
} from '@modules/cluster/services/transfer/cluster-transfer-constants';

interface TransferRequestInput {
    teamId: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    destinationClusterId: string;
    requestedBy: string;
    reason?: ClusterTransferJobReason;
}

class ClusterTransferCoordinator {
    private readonly storagePlacementService = storagePlacementService;
    private readonly systemMetricsRepository = systemMetricsRepository;
    private readonly daemonListings = new DaemonListingReplicator();
    private readonly jobStore = new ClusterTransferJobStore();
    private readonly objectCopier = new ClusterTransferObjectCopier();
    private readonly rebalancePlanner = new ClusterRebalancePlanner();

    async requestTransfer(input: TransferRequestInput): Promise<ClusterTransferJob> {
        const placement = await this.storagePlacementService.ensurePlacement(input.scopeType, input.scopeId);
        if (placement.props.team !== input.teamId) {
            throw ApplicationError.notFound(ErrorCodes.STORAGE_PLACEMENT_NOT_FOUND, 'Storage placement not found for the requested team');
        }

        const jobRequest: Partial<ClusterTransferJob['props']> = {
            team: input.teamId,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            destinationClusterId: input.destinationClusterId,
            requestedBy: input.requestedBy,
            reason: input.reason ?? 'manual'
        };

        if (placement.props.primaryClusterId === input.destinationClusterId) {
            const settledPlacement = await this.storagePlacementService.switchPrimaryCluster(
                input.scopeType,
                input.scopeId,
                input.destinationClusterId,
                {
                    state: 'active',
                    lastVerifiedAt: new Date()
                }
            );

            return this.publishJob(await this.jobStore.createTransferJob({
                ...jobRequest,
                sourceClusterId: settledPlacement.props.primaryClusterId,
                buckets: settledPlacement.props.buckets,
                state: 'completed',
                startedAt: new Date(),
                finishedAt: new Date()
            }));
        }

        const openTransferJob = await this.jobStore.findOpenTransferJobByScope(input.scopeType, input.scopeId);
        if (openTransferJob && openTransferJob.props.destinationClusterId === input.destinationClusterId) {
            return this.publishJob(openTransferJob);
        }

        await this.assertTransferClusters(placement, input.destinationClusterId);

        try {
            return this.publishJob(await this.jobStore.createTransferJob({
                ...jobRequest,
                sourceClusterId: placement.props.primaryClusterId,
                buckets: placement.props.buckets
            }));
        } catch (error) {
            const duplicate = await this.jobStore.findOpenTransferJobByScope(input.scopeType, input.scopeId);
            if (!duplicate) {
                throw error;
            }

            return this.publishJob(duplicate);
        }
    }

    async runPendingJobs(limit: number = 1): Promise<number> {
        let processedJobs = 0;

        while (processedJobs < limit) {
            const claimedJob = await this.jobStore.claimNextRunnable();
            if (!claimedJob) {
                break;
            }

            const renewTimer = setInterval(() => {
                void this.jobStore.renewClaim(claimedJob.id, CLUSTER_TRANSFER_CLAIM_TTL_MS).catch((error) => {
                    logger.warn({
                        error,
                        jobId: claimedJob.id
                    }, '[ClusterTransferCoordinator] Failed to renew claim');
                });
            }, CLUSTER_TRANSFER_CLAIM_RENEW_INTERVAL_MS);
            renewTimer.unref();

            try {
                await this.executeJob(claimedJob.id);
            } finally {
                clearInterval(renewTimer);
                await this.jobStore.releaseClaim(claimedJob.id).catch(() => undefined);
            }
            processedJobs += 1;
        }

        return processedJobs;
    }

    async planAutomaticRebalance(): Promise<number> {
        const plans = await this.rebalancePlanner.planAutomaticRebalance();

        for (const plan of plans) {
            await this.requestTransfer({
                ...plan,
                requestedBy: 'system:rebalance'
            });
        }

        return plans.length;
    }

    async executeJob(jobId: string): Promise<ClusterTransferJob> {
        const job = await this.jobStore.findById(jobId);
        if (!job) {
            throw ApplicationError.notFound(ErrorCodes.CLUSTER_TRANSFER_JOB_NOT_FOUND, 'Cluster transfer job not found');
        }

        if (!isOpenTransferJobState(job.props.state)) {
            return job;
        }

        const { scopeType, scopeId, sourceClusterId, destinationClusterId } = job.props;
        const placement = await this.storagePlacementService.ensurePlacement(scopeType, scopeId);
        await this.assertTransferClusters(placement, destinationClusterId);

        const startedJob = await this.jobStore.setJobState(job.id, 'freezing', {
            startedAt: job.props.startedAt ?? new Date(),
            errorCode: null,
            errorMessage: null
        }, {
            publishUpdate: true
        });

        try {
            await this.storagePlacementService.setPlacementState(scopeType, scopeId, 'read-only');
            const copiedJob = await this.objectCopier.copyPlacement(startedJob, placement);
            const verifiedBytes = await this.objectCopier.verifyPlacement(copiedJob, placement);
            await this.daemonListings.replicateDaemonListings(copiedJob);
            const switchingJob = await this.jobStore.setJobState(copiedJob.id, 'switching', {}, {
                publishUpdate: true
            });

            const replicaClusterIds = [...new Set([
                ...placement.props.replicaClusterIds.filter((clusterId) => clusterId !== destinationClusterId),
                sourceClusterId
            ])];
            const settlePlacement = (state: StoragePlacementState, replicas: string[]) => {
                return this.storagePlacementService.switchPrimaryCluster(scopeType, scopeId, destinationClusterId, {
                    replicaClusterIds: replicas,
                    state,
                    lastVerifiedAt: new Date(),
                    bytesUsed: verifiedBytes,
                    lastAccessedAt: new Date()
                });
            };

            await settlePlacement('moving', replicaClusterIds);
            await this.storagePlacementService.synchronizeScopeStorageOwner(scopeType, scopeId, destinationClusterId);

            const cleaningJob = await this.jobStore.setJobState(switchingJob.id, 'cleaning', {}, {
                publishUpdate: true
            });
            const deletedObjects = await this.objectCopier.cleanupSourceCopy(sourceClusterId, placement.props.buckets);
            await this.daemonListings.purgeDaemonListings(sourceClusterId, scopeType, scopeId);
            const cleanedJob = await this.jobStore.setJobState(cleaningJob.id, 'cleaning', {
                stats: {
                    ...cleaningJob.props.stats,
                    deletedObjects
                }
            });

            await settlePlacement('active', replicaClusterIds.filter((clusterId) => clusterId !== sourceClusterId));

            const completedJob = await this.jobStore.setJobState(cleanedJob.id, 'completed', {
                finishedAt: new Date(),
                cursor: {
                    bucketIndex: job.props.buckets.length,
                    lastObjectKey: null
                }
            }, {
                publishUpdate: true
            });

            logger.info(`Completed cluster transfer job ${describeClusterTransferJob(completedJob)}`);

            return completedJob;
        } catch (error) {
            await this.storagePlacementService.setPlacementState(scopeType, scopeId, 'active').catch(() => undefined);
            const failedJob = await this.jobStore.setJobState(job.id, 'failed', {
                finishedAt: new Date(),
                errorCode: error instanceof ApplicationError ? error.code : 'ClusterTransfer::Failed',
                errorMessage: error instanceof Error ? error.message : 'Cluster transfer failed'
            }, {
                publishUpdate: true
            });

            logger.error(`Cluster transfer job failed ${describeClusterTransferJob(failedJob)}`);

            return failedJob;
        }
    }

    private async publishJob(job: ClusterTransferJob): Promise<ClusterTransferJob> {
        await publishTransferJobProjection(job);
        return job;
    }

    private async assertTransferClusters(
        placement: StoragePlacement,
        destinationClusterId: string
    ): Promise<void> {
        await Promise.all([
            this.assertSourceReadableCluster(placement.props.team, placement.props.primaryClusterId),
            this.assertDestinationWritableCluster(placement.props.team, destinationClusterId)
        ]);
    }

    private async requireConnectedCluster(
        teamId: string,
        clusterId: string,
        unavailableCode: ErrorCode,
        unavailableMessage: string
    ): Promise<TeamCluster> {
        const cluster = await this.jobStore.findTeamClusterById(clusterId);
        if (!cluster || cluster.props.team !== teamId || cluster.props.status !== TeamClusterStatus.Connected) {
            throw ApplicationError.conflict(unavailableCode, unavailableMessage);
        }

        return cluster;
    }

    private async assertSourceReadableCluster(teamId: string, clusterId: string): Promise<void> {
        const cluster = await this.requireConnectedCluster(
            teamId,
            clusterId,
            'ClusterTransfer::SourceClusterUnavailable',
            'Source storage cluster is not available for transfer'
        );

        if (!cluster.effectiveCapabilities.servesStorageReads) {
            throw ApplicationError.conflict(
                ErrorCodes.CLUSTER_TRANSFER_SOURCE_CLUSTER_READ_CAPABILITY_REQUIRED,
                'Source storage cluster cannot serve authoritative reads for this transfer'
            );
        }
    }

    private async assertDestinationWritableCluster(teamId: string, clusterId: string): Promise<void> {
        const cluster = await this.requireConnectedCluster(
            teamId,
            clusterId,
            'ClusterTransfer::DestinationClusterUnavailable',
            'Destination storage cluster is not available for transfer'
        );

        if (!cluster.effectiveCapabilities.acceptsStorageWrites) {
            throw ApplicationError.conflict(
                ErrorCodes.CLUSTER_TRANSFER_DESTINATION_CLUSTER_WRITE_CAPABILITY_REQUIRED,
                'Destination storage cluster cannot accept authoritative writes for this transfer'
            );
        }

        const metrics = await this.systemMetricsRepository.getLatestByClusterId(clusterId);
        if ((metrics?.disk.usagePercent ?? 0) >= HARD_STORAGE_LIMIT_PCT) {
            throw ApplicationError.conflict(
                ErrorCodes.CLUSTER_TRANSFER_DESTINATION_CLUSTER_HARD_LIMIT_REACHED,
                'Destination storage cluster is above its hard storage limit'
            );
        }
    }
}

export default new ClusterTransferCoordinator();
