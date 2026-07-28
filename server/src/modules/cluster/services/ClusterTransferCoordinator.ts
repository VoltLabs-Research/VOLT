import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRedisRepository';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import { toClusterTransferJobLike, type ClusterTransferJob } from '@modules/cluster/contracts/domain/cluster-transfer-job';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/domain/team-cluster';
import { JobStatus } from '@shared/contracts/types';
import { GenericDomainEvent } from '@shared/domain/events/GenericDomainEvent';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import {
    HARD_STORAGE_LIMIT_PCT,
    REBALANCE_TARGET_PCT,
    SOFT_STORAGE_LIMIT_PCT
} from '@shared/application/utilities/cluster-storage-policy';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import {
    ClusterTransferJobReason as ClusterTransferJobReasonColumn,
    ClusterTransferJobState as ClusterTransferJobStateColumn,
    createClusterTransferJobProps
} from '@modules/cluster/contracts/domain/cluster-transfer-job';
import type {
    ClusterTransferJobReason,
    ClusterTransferJobState
} from '@volt/contracts/modules/cluster/domain';
import { StoragePlacementScopeType as StoragePlacementScopeTypeColumn } from '@modules/cluster/contracts/domain/storage-placement';
import type { StoragePlacement } from '@modules/cluster/contracts/domain/storage-placement';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import objectGatewayClientSingleton from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import {
    ChannelCommands,
    type TeamClusterDaemonPluginMongoDocumentType,
    type TeamClusterDaemonPluginMongoExportResult,
    type TeamClusterDaemonPluginMongoImportResult,
    type TeamClusterDaemonPluginMongoPurgeResult
} from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import { In, IsNull, LessThanOrEqual, Or } from 'typeorm';
import type { Readable } from 'node:stream';
import storagePlacementService from './StoragePlacementService';

interface ObjectHeadSnapshot {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

interface ObjectStreamSnapshot extends ObjectHeadSnapshot {
    stream: Readable;
}

interface ObjectListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobStateColumn[] = [
    ClusterTransferJobStateColumn.Queued,
    ClusterTransferJobStateColumn.Freezing,
    ClusterTransferJobStateColumn.Copying,
    ClusterTransferJobStateColumn.Verifying,
    ClusterTransferJobStateColumn.Switching,
    ClusterTransferJobStateColumn.Cleaning
];

const isOpenTransferJobState = (state: ClusterTransferJobState): boolean => {
    return OPEN_TRANSFER_JOB_STATES.includes(state as ClusterTransferJobStateColumn);
};

const MONGO_TRANSFER_BATCH_SIZE = 200;
const MONGO_DOCUMENT_TYPES: TeamClusterDaemonPluginMongoDocumentType[] = ['listing', 'sub-listing'];
const CLUSTER_TRANSFER_QUEUE_TYPE = 'cluster_transfer';
const CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID = 'cluster-transfer-operations';
const CLUSTER_TRANSFER_CLAIM_TTL_MS = 5 * 60 * 1000;
const CLUSTER_TRANSFER_CLAIM_RENEW_INTERVAL_MS = 60 * 1000;
const CLUSTER_TRANSFER_WORKER_ID = `${process.pid}:${Math.random().toString(36).slice(2, 10)}`;
const CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME = 'Cluster Transfers';
const TRANSFER_PROGRESS_FLUSH_EVERY_OBJECTS = 50;
const TRANSFER_PROGRESS_FLUSH_EVERY_BYTES = 64 * 1024 * 1024;

const mapTransferStateToJobStatus = (state: ClusterTransferJobState): JobStatus => {
    switch (state) {
        case 'completed':
            return JobStatus.Completed;
        case 'failed':
            return JobStatus.Failed;
        case 'queued':
            return JobStatus.Queued;
        default:
            return JobStatus.Running;
    }
};

const getTransferJobName = (scopeType: StoragePlacementScopeType): string => {
    switch (scopeType) {
        case 'trajectory':
            return 'Trajectory Transfer';
        case 'analysis':
            return 'Analysis Transfer';
        default:
            return 'Storage Transfer';
    }
};

const getTransferJobMessage = (job: ClusterTransferJob): string => {
    switch (job.props.state) {
        case 'queued':
            return 'Waiting for transfer worker';
        case 'freezing':
            return 'Freezing source placement';
        case 'copying':
            return 'Copying authoritative storage objects';
        case 'verifying':
            return 'Verifying copied storage objects';
        case 'switching':
            return 'Switching authoritative storage owner';
        case 'cleaning':
            return 'Cleaning source cluster copy';
        case 'completed':
            return 'Transfer completed';
        case 'failed':
            return job.props.errorMessage || 'Transfer failed';
        default:
            return 'Transfer update';
    }
};

interface TransferJobProjectionContext {
    trajectoryId: string;
    trajectoryName: string;
    analysisId?: string;
}

const normalizeOpaqueTag = (value?: string): string | undefined => {
    if (!value) {
        return undefined;
    }

    const normalized = value.trim();
    if (!normalized) {
        return undefined;
    }

    return normalized.replace(/^"+|"+$/g, '');
};

const compareObjectListingEntries = (
    sourceEntry: ObjectListEntry,
    destinationEntry: ObjectListEntry
): 'match' | 'mismatch' | 'inconclusive' => {
    if (
        typeof sourceEntry.contentLength === 'number'
        && typeof destinationEntry.contentLength === 'number'
        && sourceEntry.contentLength !== destinationEntry.contentLength
    ) {
        return 'mismatch';
    }

    const sourceTag = normalizeOpaqueTag(sourceEntry.etag);
    const destinationTag = normalizeOpaqueTag(destinationEntry.etag);
    if (sourceTag && destinationTag) {
        return sourceTag === destinationTag
            ? 'match'
            : 'inconclusive';
    }

    return 'inconclusive';
};

interface TransferRequestInput {
    teamId: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    destinationClusterId: string;
    requestedBy: string;
    reason?: ClusterTransferJobReason;
}

export class ClusterTransferCoordinator {
    private readonly storagePlacementService = storagePlacementService;
    private readonly systemMetricsRepository = systemMetricsRepository;
        private readonly teamClusterDaemonClient = teamClusterDaemonClient;
    #objectGatewayClientCache?: ITeamClusterObjectGatewayClient;
    private get objectGatewayClient(): ITeamClusterObjectGatewayClient {
        return (this.#objectGatewayClientCache ??= objectGatewayClientSingleton);
    }
        private readonly eventBus = eventBus;

    async requestTransfer(input: TransferRequestInput): Promise<ClusterTransferJob> {
        const placement = await this.storagePlacementService.ensurePlacement(input.scopeType, input.scopeId);
        if (placement.props.team !== input.teamId) {
            throw ApplicationError.notFound('StoragePlacement::NotFound', 'Storage placement not found for the requested team');
        }

        if (placement.props.primaryClusterId === input.destinationClusterId) {
            const existingPlacement = await this.storagePlacementService.switchPrimaryCluster(
                input.scopeType,
                input.scopeId,
                input.destinationClusterId,
                {
                    state: 'active',
                    lastVerifiedAt: new Date()
                }
            );

            const completedJob = await this.createTransferJob(createClusterTransferJobProps({
                team: input.teamId,
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                sourceClusterId: existingPlacement.props.primaryClusterId,
                destinationClusterId: input.destinationClusterId,
                buckets: existingPlacement.props.buckets,
                state: 'completed',
                requestedBy: input.requestedBy,
                cleanupSource: true,
                reason: input.reason ?? 'manual',
                startedAt: new Date(),
                finishedAt: new Date()
            }));

            await this.publishTransferJobProjection(completedJob);

            return completedJob;
        }

        const openTransferJob = await this.findOpenTransferJobByScope(input.scopeType, input.scopeId);
        if (openTransferJob && openTransferJob.props.destinationClusterId === input.destinationClusterId) {
            await this.publishTransferJobProjection(openTransferJob);
            return openTransferJob;
        }

        await this.assertTransferClusters(placement, input.destinationClusterId);

        let queuedJob: ClusterTransferJob;
        try {
            queuedJob = await this.createTransferJob(createClusterTransferJobProps({
                team: input.teamId,
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                sourceClusterId: placement.props.primaryClusterId,
                destinationClusterId: input.destinationClusterId,
                buckets: placement.props.buckets,
                requestedBy: input.requestedBy,
                cleanupSource: true,
                reason: input.reason ?? 'manual'
            }));
        } catch (error) {
            const duplicate = await this.findOpenTransferJobByScope(input.scopeType, input.scopeId);
            if (duplicate) {
                await this.publishTransferJobProjection(duplicate);
                return duplicate;
            }
            throw error;
        }

        await this.publishTransferJobProjection(queuedJob);

        return queuedJob;
    }

    async runPendingJobs(limit: number = 1): Promise<number> {
        let processedJobs = 0;

        while (processedJobs < limit) {
            const claimedJob = await this.claimNextRunnable();
            if (!claimedJob) {
                break;
            }

            const renewTimer = setInterval(() => {
                void this.renewClaim(
                    claimedJob.id,
                    CLUSTER_TRANSFER_CLAIM_TTL_MS
                ).catch((error) => {
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
                await this.releaseClaim(claimedJob.id).catch(() => undefined);
            }
            processedJobs += 1;
        }

        return processedJobs;
    }

    async planAutomaticRebalance(): Promise<number> {
        const teamClusterEntities = await TeamClusterEntity.findBy({ status: TeamClusterStatus.Connected });
        const teamClusters = teamClusterEntities.map(toTeamClusterLike);
        const storageClusters = teamClusters.filter((cluster) => cluster.effectiveCapabilities.acceptsStorageWrites);
        let createdJobs = 0;

        const metricsByCluster = new Map(await Promise.all(storageClusters.map(
            async (cluster) => [cluster.id, await this.systemMetricsRepository.getLatestByClusterId(cluster.id)] as const
        )));

        for (const sourceCluster of storageClusters) {
            const metrics = metricsByCluster.get(sourceCluster.id);
            const diskUsagePct = metrics?.disk.usagePercent ?? 0;
            if (diskUsagePct < SOFT_STORAGE_LIMIT_PCT) {
                continue;
            }

            const destinationCluster = this.selectRebalanceDestination(sourceCluster, storageClusters, metricsByCluster);
            if (!destinationCluster) {
                continue;
            }

            const candidatePlacement = await this.selectVictimPlacement(sourceCluster);
            if (!candidatePlacement) {
                continue;
            }

            const existingJob = await this.findOpenTransferJobByScope(
                candidatePlacement.props.scopeType,
                candidatePlacement.props.scopeId
            );
            if (existingJob) {
                continue;
            }

            await this.requestTransfer({
                teamId: sourceCluster.props.team,
                scopeType: candidatePlacement.props.scopeType,
                scopeId: candidatePlacement.props.scopeId,
                destinationClusterId: destinationCluster.id,
                requestedBy: 'system:rebalance',
                reason: diskUsagePct >= HARD_STORAGE_LIMIT_PCT ? 'hard-limit' : 'soft-limit'
            });
            createdJobs += 1;
        }

        return createdJobs;
    }

    async executeJob(jobId: string): Promise<ClusterTransferJob> {
        const jobEntity = await ClusterTransferJobEntity.findOneBy({ id: jobId });
        const job = jobEntity ? toClusterTransferJobLike(jobEntity) : null;
        if (!job) {
            throw ApplicationError.notFound('ClusterTransferJob::NotFound', 'Cluster transfer job not found');
        }

        if (!isOpenTransferJobState(job.props.state)) {
            return job;
        }

        const placement = await this.storagePlacementService.ensurePlacement(job.props.scopeType, job.props.scopeId);
        if (placement.props.primaryClusterId === job.props.destinationClusterId && job.props.state === 'completed') {
            return job;
        }

        await this.assertTransferClusters(placement, job.props.destinationClusterId);

        const startedJob = await this.setJobState(job.id, 'freezing', {
            startedAt: job.props.startedAt ?? new Date(),
            errorCode: null,
            errorMessage: null
        }, {
            publishUpdate: true
        });

        try {
            await this.storagePlacementService.setPlacementState(job.props.scopeType, job.props.scopeId, 'read-only');
            const copiedJob = await this.copyPlacement(startedJob, placement);
            const verificationResult = await this.verifyPlacement(copiedJob, placement);
            await this.replicateMongoListings(copiedJob);
            const switchingJob = await this.setJobState(copiedJob.id, 'switching', {}, {
                publishUpdate: true
            });
            const nextReplicaClusterIds = [...new Set([
                ...placement.props.replicaClusterIds.filter((clusterId) => clusterId !== job.props.destinationClusterId),
                job.props.sourceClusterId
            ])];

            await this.storagePlacementService.switchPrimaryCluster(
                job.props.scopeType,
                job.props.scopeId,
                job.props.destinationClusterId,
                {
                    replicaClusterIds: nextReplicaClusterIds,
                    state: 'moving',
                    lastVerifiedAt: new Date(),
                    bytesUsed: verificationResult.verifiedBytes,
                    lastAccessedAt: new Date()
                }
            );
            await this.storagePlacementService.synchronizeScopeStorageOwner(
                job.props.scopeType,
                job.props.scopeId,
                job.props.destinationClusterId
            );

            let finalizedReplicaClusterIds = nextReplicaClusterIds;
            let finalizedJob = switchingJob;

            finalizedJob = await this.setJobState(switchingJob.id, 'cleaning', {}, {
                publishUpdate: true
            });
            const cleanupResult = await this.cleanupSourceCopy(
                job.props.sourceClusterId,
                placement.props.buckets,
                job.props.scopeType,
                job.props.scopeId
            );
            finalizedReplicaClusterIds = nextReplicaClusterIds.filter((clusterId) => clusterId !== job.props.sourceClusterId);
            finalizedJob = await this.setJobState(finalizedJob.id, 'cleaning', {
                stats: {
                    ...finalizedJob.props.stats,
                    deletedObjects: cleanupResult.deletedObjects
                }
            });

            await this.storagePlacementService.switchPrimaryCluster(
                job.props.scopeType,
                job.props.scopeId,
                job.props.destinationClusterId,
                {
                    replicaClusterIds: finalizedReplicaClusterIds,
                    state: 'active',
                    lastVerifiedAt: new Date(),
                    bytesUsed: verificationResult.verifiedBytes,
                    lastAccessedAt: new Date()
                }
            );

            const completedJob = await this.setJobState(finalizedJob.id, 'completed', {
                finishedAt: new Date(),
                cursor: {
                    bucketIndex: job.props.buckets.length,
                    lastObjectKey: null
                }
            }, {
                publishUpdate: true
            });

            logger.info(`Completed cluster transfer job transferJobId=${completedJob.id} scopeType=${completedJob.props.scopeType} scopeId=${completedJob.props.scopeId} sourceClusterId=${completedJob.props.sourceClusterId}`);

            return completedJob;
        } catch (error) {
            await this.storagePlacementService.setPlacementState(job.props.scopeType, job.props.scopeId, 'active').catch(() => undefined);
            const failedJob = await this.setJobState(job.id, 'failed', {
                finishedAt: new Date(),
                errorCode: error instanceof ApplicationError ? error.code : 'ClusterTransfer::Failed',
                errorMessage: error instanceof Error ? error.message : 'Cluster transfer failed'
            }, {
                publishUpdate: true
            });

            logger.error(`Cluster transfer job failed transferJobId=${failedJob.id} scopeType=${failedJob.props.scopeType} scopeId=${failedJob.props.scopeId} sourceClusterId=${failedJob.props.sourceClusterId}`);

            return failedJob;
        }
    }

    private async copyPlacement(
        job: ClusterTransferJob,
        placement: StoragePlacement
    ): Promise<ClusterTransferJob> {
        logger.info(`Starting cluster transfer copy phase transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId} sourceClusterId=${job.props.sourceClusterId}`);

        let currentJob = await this.setJobState(job.id, 'copying', {}, {
            publishUpdate: true
        });

        for (let bucketIndex = currentJob.props.cursor.bucketIndex; bucketIndex < placement.props.buckets.length; bucketIndex += 1) {
            const bucketRef = placement.props.buckets[bucketIndex];
            const startingAfter = bucketIndex === currentJob.props.cursor.bucketIndex
                ? currentJob.props.cursor.lastObjectKey
                : null;
            const destinationEntries = await this.listObjectEntries(
                job.props.destinationClusterId,
                bucketRef.bucket,
                bucketRef.prefix
            );
            const destinationEntryMap = new Map(destinationEntries.map((entry) => [entry.key, entry]));
            let pendingCopiedObjects = 0;
            let pendingCopiedBytes = 0;

            const flushProgress = async (nextCursor: { bucketIndex: number; lastObjectKey: string | null; }) => {
                currentJob = await this.setJobState(currentJob.id, 'copying', {
                    cursor: nextCursor,
                    stats: {
                        ...currentJob.props.stats,
                        copiedObjects: currentJob.props.stats.copiedObjects + pendingCopiedObjects,
                        copiedBytes: currentJob.props.stats.copiedBytes + pendingCopiedBytes
                    }
                }, {
                    publishUpdate: true
                });

                pendingCopiedObjects = 0;
                pendingCopiedBytes = 0;
            };

            for await (const sourceEntry of this.iterateObjectEntries(job.props.sourceClusterId, bucketRef.bucket, bucketRef.prefix)) {
                if (startingAfter && sourceEntry.key <= startingAfter) {
                    continue;
                }

                const copyResult = await this.copySingleObject(
                    job.props.sourceClusterId,
                    job.props.destinationClusterId,
                    bucketRef.bucket,
                    sourceEntry,
                    destinationEntryMap.get(sourceEntry.key)
                );

                pendingCopiedObjects += copyResult.copied ? 1 : 0;
                pendingCopiedBytes += copyResult.bytesTransferred;

                if (
                    pendingCopiedObjects >= TRANSFER_PROGRESS_FLUSH_EVERY_OBJECTS
                    || pendingCopiedBytes >= TRANSFER_PROGRESS_FLUSH_EVERY_BYTES
                ) {
                    await flushProgress({
                        bucketIndex,
                        lastObjectKey: sourceEntry.key
                    });
                }
            }

            await flushProgress({
                bucketIndex: bucketIndex + 1,
                lastObjectKey: null
            });
        }

        return currentJob;
    }

    private async verifyPlacement(
        job: ClusterTransferJob,
        placement: StoragePlacement
    ): Promise<{ verifiedObjects: number; verifiedBytes: number; }> {
        let currentJob = await this.setJobState(job.id, 'verifying', {}, {
            publishUpdate: true
        });
        let verifiedObjects = 0;
        let verifiedBytes = 0;

        for (const bucketRef of placement.props.buckets) {
            const destinationEntries = await this.listObjectEntries(job.props.destinationClusterId, bucketRef.bucket, bucketRef.prefix);
            const destinationEntryMap = new Map(destinationEntries.map((entry) => [entry.key, entry]));
            let sourceObjectCount = 0;

            for await (const sourceEntry of this.iterateObjectEntries(job.props.sourceClusterId, bucketRef.bucket, bucketRef.prefix)) {
                sourceObjectCount += 1;
                const destinationEntry = destinationEntryMap.get(sourceEntry.key);
                if (!destinationEntry) {
                    throw ApplicationError.conflict(
                        'ClusterTransfer::VerificationMissingDestinationObject',
                        `Verification failed because destination is missing object ${sourceEntry.key}`
                    );
                }

                const listingComparison = compareObjectListingEntries(sourceEntry, destinationEntry);
                if (listingComparison === 'mismatch') {
                    throw ApplicationError.conflict(
                        'ClusterTransfer::VerificationSizeMismatch',
                        `Verification failed because ${sourceEntry.key} has mismatched content length`
                    );
                }

                if (listingComparison === 'match') {
                    verifiedObjects += 1;
                    verifiedBytes += sourceEntry.contentLength ?? destinationEntry.contentLength ?? 0;
                    continue;
                }

                const [sourceHead, destinationHead] = await Promise.all([
                    this.headObject(job.props.sourceClusterId, bucketRef.bucket, sourceEntry.key),
                    this.headObject(job.props.destinationClusterId, bucketRef.bucket, sourceEntry.key)
                ]);

                if ((sourceHead.contentLength ?? null) !== (destinationHead.contentLength ?? null)) {
                    throw ApplicationError.conflict(
                        'ClusterTransfer::VerificationSizeMismatch',
                        `Verification failed because ${sourceEntry.key} has mismatched content length`
                    );
                }

                const expectedHash = sourceHead.metadata.sha256;
                if (expectedHash && destinationHead.metadata.sha256 && expectedHash !== destinationHead.metadata.sha256) {
                    throw ApplicationError.conflict(
                        'ClusterTransfer::VerificationHashMismatch',
                        `Verification failed because ${sourceEntry.key} has mismatched sha256 metadata`
                    );
                }

                verifiedObjects += 1;
                verifiedBytes += sourceHead.contentLength ?? 0;
            }

            if (sourceObjectCount !== destinationEntries.length) {
                throw ApplicationError.conflict(
                    'ClusterTransfer::VerificationMismatch',
                    `Verification failed for ${bucketRef.bucket}:${bucketRef.prefix} because object counts do not match`
                );
            }
        }

        currentJob = await this.setJobState(currentJob.id, 'verifying', {
            stats: {
                ...currentJob.props.stats,
                verifiedObjects,
                verifiedBytes
            }
        });

        return {
            verifiedObjects,
            verifiedBytes
        };
    }

    private async cleanupSourceCopy(
        sourceClusterId: string,
        buckets: StoragePlacementBucketRef[],
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<{ deletedObjects: number; deletedMongoRows: number; }> {
        let deletedObjects = 0;

        for (const bucketRef of buckets) {
            const sourceKeys = await this.listObjectKeys(sourceClusterId, bucketRef.bucket, bucketRef.prefix);
            deletedObjects += sourceKeys.length;
            await this.deleteByPrefix(sourceClusterId, bucketRef.bucket, bucketRef.prefix);
        }

        const deletedMongoRows = await this.purgeMongoListings(sourceClusterId, scopeType, scopeId);

        return {
            deletedObjects,
            deletedMongoRows
        };
    }

    private async copySingleObject(
        sourceClusterId: string,
        destinationClusterId: string,
        bucket: string,
        sourceEntry: ObjectListEntry,
        destinationEntry?: ObjectListEntry
    ): Promise<{ copied: boolean; bytesTransferred: number; }> {
        if (destinationEntry) {
            const listingComparison = compareObjectListingEntries(sourceEntry, destinationEntry);
            if (listingComparison === 'match') {
                return {
                    copied: false,
                    bytesTransferred: 0
                };
            }

            if (listingComparison === 'inconclusive') {
                const sourceHead = await this.headObject(sourceClusterId, bucket, sourceEntry.key);
                const destinationHead = await this.tryHeadObject(destinationClusterId, bucket, sourceEntry.key);

                if (
                    destinationHead
                    && destinationHead.contentLength === sourceHead.contentLength
                    && (!sourceHead.metadata.sha256 || destinationHead.metadata.sha256 === sourceHead.metadata.sha256)
                ) {
                    return {
                        copied: false,
                        bytesTransferred: 0
                    };
                }
            }
        }

        const sourceObject = await this.getObjectStream(sourceClusterId, bucket, sourceEntry.key);

        await this.putObjectStream(destinationClusterId, bucket, sourceEntry.key, sourceObject);

        return {
            copied: true,
            bytesTransferred: sourceObject.contentLength ?? sourceEntry.contentLength ?? 0
        };
    }

    private async replicateMongoListings(job: ClusterTransferJob): Promise<void> {
        const analysisIds = await this.resolveMongoReplicationAnalysisIds(
            job.props.scopeType,
            job.props.scopeId,
            job.props.sourceClusterId
        );
        if (!analysisIds.length) {
            return;
        }

        logger.info(`Replicating daemon Mongo listing state for cluster transfer transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId} sourceClusterId=${job.props.sourceClusterId}`);

        for (const documentType of MONGO_DOCUMENT_TYPES) {
            let skip = 0;

            while (true) {
                const batch = await this.teamClusterDaemonClient.command<TeamClusterDaemonPluginMongoExportResult>(
                    job.props.sourceClusterId,
                    ChannelCommands.PluginTransferMongoExport,
                    {
                        analysisIds,
                        documentType,
                        skip,
                        limit: MONGO_TRANSFER_BATCH_SIZE
                    },
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'safe-read'
                    }
                );

                if (batch.rows.length > 0) {
                    await this.teamClusterDaemonClient.command<TeamClusterDaemonPluginMongoImportResult>(
                        job.props.destinationClusterId,
                        ChannelCommands.PluginTransferMongoImport,
                        {
                            analysisIds,
                            documentType,
                            rows: batch.rows
                        },
                        {
                            timeoutClass: 'long-running-control-plane',
                            retryClass: 'idempotent-command'
                        }
                    );
                }

                if (!batch.hasMore || batch.rows.length === 0) {
                    break;
                }

                skip = batch.nextSkip;
            }
        }

        logger.info(`Replicated daemon Mongo listing state for cluster transfer transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId} sourceClusterId=${job.props.sourceClusterId}`);
    }

    private async purgeMongoListings(
        sourceClusterId: string,
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<number> {
        const analysisIds = await this.resolveMongoReplicationAnalysisIds(scopeType, scopeId, sourceClusterId);
        if (!analysisIds.length) {
            return 0;
        }

        let deletedRows = 0;

        for (const documentType of MONGO_DOCUMENT_TYPES) {
            const result = await this.teamClusterDaemonClient.command<TeamClusterDaemonPluginMongoPurgeResult>(
                sourceClusterId,
                ChannelCommands.PluginTransferMongoPurge,
                {
                    analysisIds,
                    documentType
                },
                {
                    timeoutClass: 'long-running-control-plane',
                    retryClass: 'idempotent-command'
                }
            );
            deletedRows += result.deletedRows;
        }

        logger.info(`Purged source daemon Mongo listing state for cluster transfer sourceClusterId=${sourceClusterId} scopeType=${scopeType} scopeId=${scopeId} analysisCount=${analysisIds.length}`);

        return deletedRows;
    }

    private async resolveMongoReplicationAnalysisIds(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        sourceClusterId: string
    ): Promise<string[]> {
        if (scopeType === 'plugin-binary') {
            return [];
        }

        if (scopeType === 'analysis') {
            const analysis = await Analysis.findOneBy({ id: scopeId });
            if (!analysis) {
                return [];
            }

            return resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined }) === sourceClusterId
                ? [analysis.id]
                : [];
        }

        const analyses = await Analysis.find({
            where: { trajectory: scopeId },
            order: { createdAt: 'ASC' }
        });

        return analyses
            .filter((analysis) => resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined }) === sourceClusterId)
            .map((analysis) => analysis.id);
    }

    private async selectVictimPlacement(sourceCluster: TeamCluster): Promise<StoragePlacement | null> {
        const placements = await this.storagePlacementService.resolveTransferPlacementsForCluster(
            sourceCluster.props.team,
            sourceCluster.id
        );
        if (!placements.length) {
            return null;
        }

        const scoredPlacements = placements.sort((left, right) => {
            const rightBytes = right.props.bytesUsed ?? 0;
            const leftBytes = left.props.bytesUsed ?? 0;
            if (rightBytes !== leftBytes) {
                return rightBytes - leftBytes;
            }

            const leftAccessedAt = left.props.lastAccessedAt?.getTime() ?? 0;
            const rightAccessedAt = right.props.lastAccessedAt?.getTime() ?? 0;
            return leftAccessedAt - rightAccessedAt;
        });

        return scoredPlacements[0] ?? null;
    }

    private selectRebalanceDestination(
        sourceCluster: TeamCluster,
        storageClusters: TeamCluster[],
        metricsByCluster: Map<string, SystemMetrics | null>
    ): TeamCluster | null {
        const candidates: Array<{ cluster: TeamCluster; diskUsage: number; }> = [];

        for (const candidate of storageClusters) {
            if (candidate.id === sourceCluster.id || candidate.props.team !== sourceCluster.props.team) {
                continue;
            }

            const metrics = metricsByCluster.get(candidate.id);
            const diskUsage = metrics?.disk.usagePercent ?? 0;
            if (diskUsage >= REBALANCE_TARGET_PCT) {
                continue;
            }

            candidates.push({
                cluster: candidate,
                diskUsage
            });
        }

        candidates.sort((left, right) => left.diskUsage - right.diskUsage);
        return candidates[0]?.cluster ?? null;
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

    private async assertSourceReadableCluster(teamId: string, clusterId: string): Promise<void> {
        const cluster = await this.findTeamClusterById(clusterId);
        if (!cluster || cluster.props.team !== teamId || cluster.props.status !== TeamClusterStatus.Connected) {
            throw ApplicationError.conflict(
                'ClusterTransfer::SourceClusterUnavailable',
                'Source storage cluster is not available for transfer'
            );
        }

        if (!cluster.effectiveCapabilities.servesStorageReads) {
            throw ApplicationError.conflict(
                'ClusterTransfer::SourceClusterReadCapabilityRequired',
                'Source storage cluster cannot serve authoritative reads for this transfer'
            );
        }
    }

    private async assertDestinationWritableCluster(teamId: string, clusterId: string): Promise<void> {
        const cluster = await this.findTeamClusterById(clusterId);
        if (!cluster || cluster.props.team !== teamId || cluster.props.status !== TeamClusterStatus.Connected) {
            throw ApplicationError.conflict(
                'ClusterTransfer::DestinationClusterUnavailable',
                'Destination storage cluster is not available for transfer'
            );
        }

        if (!cluster.effectiveCapabilities.acceptsStorageWrites) {
            throw ApplicationError.conflict(
                'ClusterTransfer::DestinationClusterWriteCapabilityRequired',
                'Destination storage cluster cannot accept authoritative writes for this transfer'
            );
        }

        const metrics = await this.systemMetricsRepository.getLatestByClusterId(clusterId);
        if ((metrics?.disk.usagePercent ?? 0) >= HARD_STORAGE_LIMIT_PCT) {
            throw ApplicationError.conflict(
                'ClusterTransfer::DestinationClusterHardLimitReached',
                'Destination storage cluster is above its hard storage limit'
            );
        }
    }

    private async *iterateObjectEntries(
        ownerClusterId: string,
        bucket: string,
        prefix: string
    ): AsyncIterable<ObjectListEntry> {
        yield* this.objectGatewayClient.listAllEntries(ownerClusterId, {
            bucket,
            prefix
        });
    }

    private async listObjectEntries(
        ownerClusterId: string,
        bucket: string,
        prefix: string
    ): Promise<ObjectListEntry[]> {
        const entries: ObjectListEntry[] = [];
        for await (const entry of this.iterateObjectEntries(ownerClusterId, bucket, prefix)) {
            entries.push(entry);
        }

        return entries.sort((left, right) => left.key.localeCompare(right.key));
    }

    private async listObjectKeys(
        ownerClusterId: string,
        bucket: string,
        prefix: string
    ): Promise<string[]> {
        return (await this.listObjectEntries(ownerClusterId, bucket, prefix)).map((entry) => entry.key);
    }

    private async tryHeadObject(
        ownerClusterId: string,
        bucket: string,
        objectKey: string
    ): Promise<ObjectHeadSnapshot | null> {
        try {
            return await this.headObject(ownerClusterId, bucket, objectKey);
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return null;
            }

            throw error;
        }
    }

    private async headObject(
        ownerClusterId: string,
        bucket: string,
        objectKey: string
    ): Promise<ObjectHeadSnapshot> {
        const head = await this.objectGatewayClient.head(ownerClusterId, bucket, objectKey);
        return {
            ...head,
            etag: normalizeOpaqueTag(head.etag)
        };
    }

    private async getObjectStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string
    ): Promise<ObjectStreamSnapshot> {
        const response = await this.objectGatewayClient.getStream(ownerClusterId, bucket, objectKey);
        return {
            ...response,
            etag: normalizeOpaqueTag(response.etag)
        };
    }

    private async putObjectStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        object: ObjectStreamSnapshot
    ): Promise<void> {
        await this.objectGatewayClient.putStream(ownerClusterId, {
            bucket,
            objectKey,
            stream: object.stream,
            contentLength: object.contentLength ?? 0,
            contentType: object.contentType,
            contentEncoding: object.contentEncoding,
            metadata: object.metadata
        });
    }

    private async deleteByPrefix(
        ownerClusterId: string,
        bucket: string,
        prefix: string
    ): Promise<void> {
        await this.objectGatewayClient.deleteByPrefix(ownerClusterId, bucket, prefix);
    }

    private async publishTransferJobProjection(job: ClusterTransferJob): Promise<void> {
        try {
            const projectionContext = await this.resolveTransferJobProjectionContext(job);
            const status = mapTransferStateToJobStatus(job.props.state);

            await this.eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.JobStatusChanged, {
                jobId: job.id,
                teamId: job.props.team,
                status,
                queueType: CLUSTER_TRANSFER_QUEUE_TYPE,
                name: getTransferJobName(job.props.scopeType),
                message: getTransferJobMessage(job),
                trajectoryId: projectionContext.trajectoryId,
                trajectoryName: projectionContext.trajectoryName,
                analysisId: projectionContext.analysisId,
                source: 'projected',
                backingSource: 'local',
                cleanupScope: 'cluster-transfer',
                transferJobId: job.id,
                transferState: job.props.state,
                transferReason: job.props.reason,
                transferScopeType: job.props.scopeType,
                transferScopeId: job.props.scopeId,
                sourceClusterId: job.props.sourceClusterId,
                destinationClusterId: job.props.destinationClusterId,
                cleanupSource: job.props.cleanupSource,
                copiedObjects: job.props.stats.copiedObjects,
                copiedBytes: job.props.stats.copiedBytes,
                verifiedObjects: job.props.stats.verifiedObjects,
                verifiedBytes: job.props.stats.verifiedBytes,
                deletedObjects: job.props.stats.deletedObjects,
                ...(job.props.errorMessage ? { error: job.props.errorMessage } : {})
            }));
        } catch {
            logger.warn(`Failed to project cluster transfer job into team jobs history transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId}`);
        }
    }

    private async resolveTransferJobProjectionContext(
        job: ClusterTransferJob
    ): Promise<TransferJobProjectionContext> {
        if (job.props.scopeType === 'trajectory') {
            const trajectory = await Trajectory.findOne({
                where: { id: job.props.scopeId },
                select: {
                    id: true,
                    name: true
                }
            });

            return {
                trajectoryId: job.props.scopeId,
                trajectoryName: trajectory?.name || `Trajectory ${job.props.scopeId}`
            };
        }

        if (job.props.scopeType === 'analysis') {
            const analysis = await Analysis.findOne({
                where: { id: job.props.scopeId },
                select: {
                    id: true,
                    trajectory: true
                }
            });
            const trajectoryId = analysis?.trajectory;

            if (trajectoryId) {
                const trajectory = await Trajectory.findOne({
                    where: { id: trajectoryId },
                    select: {
                        id: true,
                        name: true
                    }
                });

                return {
                    trajectoryId,
                    trajectoryName: trajectory?.name || `Trajectory ${trajectoryId}`,
                    analysisId: job.props.scopeId
                };
            }
        }

        return {
            trajectoryId: CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID,
            trajectoryName: CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME,
            ...(job.props.scopeType === 'analysis' ? { analysisId: job.props.scopeId } : {})
        };
    }

    private async setJobState(
        jobId: string,
        state: ClusterTransferJobState,
        data: Partial<ClusterTransferJob['props']> = {},
        options: {
            publishUpdate?: boolean;
        } = {}
    ): Promise<ClusterTransferJob> {
        const jobEntity = await ClusterTransferJobEntity.findOneBy({ id: jobId });
        if (!jobEntity) {
            throw ApplicationError.notFound('ClusterTransferJob::NotFound', 'Cluster transfer job not found during update');
        }

        const updatedJobEntity = await Object.assign(jobEntity, {
            ...this.toJobEntityPatch(data),
            state: state as ClusterTransferJobStateColumn
        }).save();
        const updatedJob = toClusterTransferJobLike(updatedJobEntity);

        if (options.publishUpdate) {
            await this.publishTransferJobProjection(updatedJob);
        }

        return updatedJob;
    }

    private toJobEntityPatch(data: Partial<ClusterTransferJob['props']>): Partial<ClusterTransferJobEntity> {
        const patch: Partial<ClusterTransferJobEntity> = {};

        if (data.team !== undefined) patch.team = data.team;
        if (data.scopeType !== undefined) patch.scopeType = data.scopeType as StoragePlacementScopeTypeColumn;
        if (data.scopeId !== undefined) patch.scopeId = data.scopeId;
        if (data.sourceClusterId !== undefined) patch.sourceClusterId = data.sourceClusterId;
        if (data.destinationClusterId !== undefined) patch.destinationClusterId = data.destinationClusterId;
        if (data.buckets !== undefined) patch.buckets = data.buckets;
        if (data.state !== undefined) patch.state = data.state as ClusterTransferJobStateColumn;
        if (data.reason !== undefined) patch.reason = data.reason as ClusterTransferJobReasonColumn;
        if (data.cleanupSource !== undefined) patch.cleanupSource = data.cleanupSource;
        if (data.requestedBy !== undefined) patch.requestedBy = data.requestedBy;
        if (data.cursor !== undefined) patch.cursor = data.cursor;
        if (data.stats !== undefined) patch.stats = data.stats;
        if (data.errorCode !== undefined) patch.errorCode = data.errorCode;
        if (data.errorMessage !== undefined) patch.errorMessage = data.errorMessage;
        if (data.startedAt !== undefined) patch.startedAt = data.startedAt;
        if (data.finishedAt !== undefined) patch.finishedAt = data.finishedAt;

        return patch;
    }

    private async createTransferJob(props: Partial<ClusterTransferJob['props']>): Promise<ClusterTransferJob> {
        const created = await ClusterTransferJobEntity.create({ ...this.toJobEntityPatch(props) }).save();
        return toClusterTransferJobLike(created);
    }

    private async findOpenTransferJobByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<ClusterTransferJob | null> {
        const entity = await ClusterTransferJobEntity.findOne({
            where: {
                scopeType: scopeType as StoragePlacementScopeTypeColumn,
                scopeId,
                state: In(OPEN_TRANSFER_JOB_STATES)
            },
            order: { createdAt: 'DESC' }
        });

        return entity ? toClusterTransferJobLike(entity) : null;
    }

    private async claimNextRunnable(): Promise<ClusterTransferJob | null> {
        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + CLUSTER_TRANSFER_CLAIM_TTL_MS);
        const candidates = await ClusterTransferJobEntity.find({
            where: [
                {
                    state: In(OPEN_TRANSFER_JOB_STATES),
                    claimedBy: IsNull()
                },
                {
                    state: In(OPEN_TRANSFER_JOB_STATES),
                    claimExpiresAt: Or(IsNull(), LessThanOrEqual(now))
                }
            ],
            order: {
                updatedAt: 'ASC',
                createdAt: 'ASC'
            },
            select: { id: true }
        });

        for (const candidate of candidates) {
            const claimed = await this.tryClaimJob(candidate.id, now, claimExpiresAt);
            if (!claimed) {
                continue;
            }

            return claimed;
        }

        return null;
    }

    private async tryClaimJob(jobId: string, now: Date, claimExpiresAt: Date): Promise<ClusterTransferJob | null> {
        const claim = {
            claimedBy: CLUSTER_TRANSFER_WORKER_ID,
            claimExpiresAt
        };
        const unclaimed = await ClusterTransferJobEntity.update({
            id: jobId,
            state: In(OPEN_TRANSFER_JOB_STATES),
            claimedBy: IsNull()
        }, claim);

        if (!unclaimed.affected) {
            const expired = await ClusterTransferJobEntity.update({
                id: jobId,
                state: In(OPEN_TRANSFER_JOB_STATES),
                claimExpiresAt: Or(IsNull(), LessThanOrEqual(now))
            }, claim);

            if (!expired.affected) {
                return null;
            }
        }

        const entity = await ClusterTransferJobEntity.findOneBy({ id: jobId });
        return entity ? toClusterTransferJobLike(entity) : null;
    }

    private async renewClaim(jobId: string, claimTtlMs: number): Promise<boolean> {
        const claimExpiresAt = new Date(Date.now() + claimTtlMs);
        const result = await ClusterTransferJobEntity.update({
            id: jobId,
            claimedBy: CLUSTER_TRANSFER_WORKER_ID
        }, { claimExpiresAt });

        return (result.affected ?? 0) > 0;
    }

    private async releaseClaim(jobId: string): Promise<void> {
        await ClusterTransferJobEntity.update({
            id: jobId,
            claimedBy: CLUSTER_TRANSFER_WORKER_ID
        }, {
            claimedBy: null,
            claimExpiresAt: null
        });
    }

    private async findTeamClusterById(clusterId: string): Promise<TeamCluster | null> {
        const entity = await TeamClusterEntity.findOneBy({ id: clusterId });
        return entity ? toTeamClusterLike(entity) : null;
    }
}

export default new ClusterTransferCoordinator();
