import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent, { type JobStatusChangedValue } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import { resolveAnalysisComputeClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import {
    HARD_STORAGE_LIMIT_PCT,
    REBALANCE_TARGET_PCT,
    SOFT_STORAGE_LIMIT_PCT
} from '@modules/team-cluster/application/services/cluster-storage-policy';
import ClusterTransferJob, {
    ClusterTransferJobReason,
    ClusterTransferJobState,
    createClusterTransferJobProps
} from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import StoragePlacement from '@modules/team-cluster/domain/entities/StoragePlacement';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import {
    TEAM_CLUSTER_DAEMON_COMMAND,
    type TeamClusterDaemonPluginMongoDocumentType,
    type TeamClusterDaemonPluginMongoExportResult,
    type TeamClusterDaemonPluginMongoImportResult,
    type TeamClusterDaemonPluginMongoPurgeResult,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type StoragePlacementBucketRef,
    type StoragePlacementScopeType
} from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { Readable } from 'node:stream';
import type { FileMetadata } from '@shared/domain/port/IStorageService';
import type ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import type StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type StoragePlacementService from './StoragePlacementService';

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

interface TransferRequestInput {
    teamId: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    destinationClusterId: string;
    requestedBy: string;
    reason?: ClusterTransferJobReason;
}

const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobState[] = [
    'queued',
    'freezing',
    'copying',
    'verifying',
    'switching',
    'cleaning'
];

const MONGO_TRANSFER_BATCH_SIZE = 200;
const MONGO_DOCUMENT_TYPES: TeamClusterDaemonPluginMongoDocumentType[] = ['listing', 'sub-listing'];
const CLUSTER_TRANSFER_QUEUE_TYPE = 'cluster_transfer';
const CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID = 'cluster-transfer-operations';
const CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME = 'Cluster Transfers';
const TRANSFER_PROGRESS_FLUSH_EVERY_OBJECTS = 50;
const TRANSFER_PROGRESS_FLUSH_EVERY_BYTES = 64 * 1024 * 1024;

const mapTransferStateToJobStatus = (state: ClusterTransferJobState): JobStatusChangedValue => {
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

const readStringMetadata = (metadata: FileMetadata, key: string): string | undefined => {
    const value = metadata[key];
    return typeof value === 'string' && value.length > 0
        ? value
        : undefined;
};

const buildLocalUploadMetadata = (head: ObjectHeadSnapshot): Record<string, string> => {
    const metadata = { ...head.metadata };

    if (head.contentType) {
        metadata['Content-Type'] = head.contentType;
    }

    if (head.contentEncoding) {
        metadata['Content-Encoding'] = head.contentEncoding;
    }

    return metadata;
};

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

@injectable()
export default class ClusterTransferCoordinator {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementRepository)
        private readonly storagePlacementRepository: StoragePlacementRepository,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferJobRepository)
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly systemMetricsRepository: ISystemMetricsRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

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

            const completedJob = await this.clusterTransferJobRepository.create(createClusterTransferJobProps({
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

        const openTransferJob = await this.clusterTransferJobRepository.findOpenByScope(input.scopeType, input.scopeId);
        if (openTransferJob && openTransferJob.props.destinationClusterId === input.destinationClusterId) {
            await this.publishTransferJobProjection(openTransferJob);
            return openTransferJob;
        }

        await this.assertTransferClusters(placement, input.destinationClusterId);

        const queuedJob = await this.clusterTransferJobRepository.create(createClusterTransferJobProps({
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

        await this.publishTransferJobProjection(queuedJob);

        return queuedJob;
    }

    async runPendingJobs(limit: number = 1): Promise<number> {
        let processedJobs = 0;

        while (processedJobs < limit) {
            const nextJob = await this.clusterTransferJobRepository.findNextRunnable();
            if (!nextJob) {
                break;
            }

            await this.executeJob(nextJob.id);
            processedJobs += 1;
        }

        return processedJobs;
    }

    async planAutomaticRebalance(): Promise<number> {
        const teamClusters = await this.teamClusterRepository.export({
            filter: {
                status: TeamClusterStatus.Connected
            }
        });
        const storageClusters = teamClusters.filter((cluster) => cluster.effectiveCapabilities.acceptsStorageWrites);
        let createdJobs = 0;

        for (const sourceCluster of storageClusters) {
            const metrics = await this.systemMetricsRepository.getLatestByClusterId(sourceCluster.id);
            const diskUsagePct = metrics?.disk.usagePercent ?? 0;
            if (diskUsagePct < SOFT_STORAGE_LIMIT_PCT) {
                continue;
            }

            const destinationCluster = await this.selectRebalanceDestination(sourceCluster, storageClusters);
            if (!destinationCluster) {
                continue;
            }

            const candidatePlacement = await this.selectVictimPlacement(sourceCluster);
            if (!candidatePlacement) {
                continue;
            }

            const existingJob = await this.clusterTransferJobRepository.findOpenByScope(
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
        const job = await this.clusterTransferJobRepository.findById(jobId);
        if (!job) {
            throw ApplicationError.notFound('ClusterTransferJob::NotFound', 'Cluster transfer job not found');
        }

        if (!OPEN_TRANSFER_JOB_STATES.includes(job.props.state)) {
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

            logger.info({
                action: 'cluster.transfer.completed',
                transferJobId: completedJob.id,
                scopeType: completedJob.props.scopeType,
                scopeId: completedJob.props.scopeId,
                sourceClusterId: completedJob.props.sourceClusterId,
                destinationClusterId: completedJob.props.destinationClusterId,
                copiedObjects: completedJob.props.stats.copiedObjects,
                copiedBytes: completedJob.props.stats.copiedBytes,
                verifiedObjects: completedJob.props.stats.verifiedObjects,
                verifiedBytes: completedJob.props.stats.verifiedBytes
            }, 'Completed cluster transfer job');

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

            logger.error({
                action: 'cluster.transfer.verify.failed',
                transferJobId: failedJob.id,
                scopeType: failedJob.props.scopeType,
                scopeId: failedJob.props.scopeId,
                sourceClusterId: failedJob.props.sourceClusterId,
                destinationClusterId: failedJob.props.destinationClusterId,
                error
            }, 'Cluster transfer job failed');

            return failedJob;
        }
    }

    private async copyPlacement(
        job: ClusterTransferJob,
        placement: StoragePlacement
    ): Promise<ClusterTransferJob> {
        logger.info({
            action: 'cluster.transfer.copy.started',
            transferJobId: job.id,
            scopeType: job.props.scopeType,
            scopeId: job.props.scopeId,
            sourceClusterId: job.props.sourceClusterId,
            destinationClusterId: job.props.destinationClusterId
        }, 'Starting cluster transfer copy phase');

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
        if (
            job.props.sourceClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
            || job.props.destinationClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
        ) {
            return;
        }

        const analysisIds = await this.resolveMongoReplicationAnalysisIds(
            job.props.scopeType,
            job.props.scopeId,
            job.props.sourceClusterId
        );
        if (!analysisIds.length) {
            return;
        }

        logger.info({
            action: 'cluster.transfer.mongo.copy.started',
            transferJobId: job.id,
            scopeType: job.props.scopeType,
            scopeId: job.props.scopeId,
            sourceClusterId: job.props.sourceClusterId,
            destinationClusterId: job.props.destinationClusterId,
            analysisCount: analysisIds.length
        }, 'Replicating daemon Mongo listing state for cluster transfer');

        for (const documentType of MONGO_DOCUMENT_TYPES) {
            let skip = 0;

            while (true) {
                const batch = await this.teamClusterDaemonClient.command<TeamClusterDaemonPluginMongoExportResult>(
                    job.props.sourceClusterId,
                    TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.export,
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
                        TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.import,
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

        logger.info({
            action: 'cluster.transfer.mongo.copy.completed',
            transferJobId: job.id,
            scopeType: job.props.scopeType,
            scopeId: job.props.scopeId,
            sourceClusterId: job.props.sourceClusterId,
            destinationClusterId: job.props.destinationClusterId,
            analysisCount: analysisIds.length
        }, 'Replicated daemon Mongo listing state for cluster transfer');
    }

    private async purgeMongoListings(
        sourceClusterId: string,
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<number> {
        if (sourceClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            return 0;
        }

        const analysisIds = await this.resolveMongoReplicationAnalysisIds(scopeType, scopeId, sourceClusterId);
        if (!analysisIds.length) {
            return 0;
        }

        let deletedRows = 0;

        for (const documentType of MONGO_DOCUMENT_TYPES) {
            const result = await this.teamClusterDaemonClient.command<TeamClusterDaemonPluginMongoPurgeResult>(
                sourceClusterId,
                TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.purge,
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

        logger.info({
            action: 'cluster.transfer.mongo.purge.completed',
            sourceClusterId,
            scopeType,
            scopeId,
            analysisCount: analysisIds.length,
            deletedRows
        }, 'Purged source daemon Mongo listing state for cluster transfer');

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
            const analysis = await this.analysisRepository.findById(scopeId);
            if (!analysis) {
                return [];
            }

            return resolveAnalysisComputeClusterId(analysis.props) === sourceClusterId
                ? [analysis.id]
                : [];
        }

        const analyses = await this.analysisRepository.export({
            filter: {
                trajectory: scopeId
            },
            sort: {
                createdAt: 1
            }
        });

        return analyses
            .filter((analysis) => resolveAnalysisComputeClusterId(analysis.props) === sourceClusterId)
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

    private async selectRebalanceDestination(
        sourceCluster: TeamCluster,
        storageClusters: TeamCluster[]
    ): Promise<TeamCluster | null> {
        const candidates: Array<{ cluster: TeamCluster; diskUsage: number; }> = [];

        for (const candidate of storageClusters) {
            if (candidate.id === sourceCluster.id || candidate.props.team !== sourceCluster.props.team) {
                continue;
            }

            const metrics = await this.systemMetricsRepository.getLatestByClusterId(candidate.id);
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
        if (clusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            return;
        }

        const cluster = await this.teamClusterRepository.findById(clusterId);
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
        if (clusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            return;
        }

        const cluster = await this.teamClusterRepository.findById(clusterId);
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
        if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            for await (const key of this.storageService.listByPrefix(bucket, prefix, true)) {
                yield {
                    key
                };
            }
            return;
        }

        yield* this.objectGatewayClient.listAllEntries(ownerClusterId, { bucket, prefix });
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
        if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            const stat = await this.storageService.getStat(bucket, objectKey);
            const head = {
                contentLength: stat.size,
                contentType: stat.mimetype,
                contentEncoding: readStringMetadata(stat, 'Content-Encoding') ?? readStringMetadata(stat, 'content-encoding'),
                etag: stat.etag,
                lastModified: stat.lastModified,
                metadata: Object.fromEntries(
                    Object.entries(stat)
                        .filter(([key, value]) => key.startsWith('x-amz-meta-') && typeof value === 'string')
                        .map(([key, value]) => [key.slice('x-amz-meta-'.length), value as string])
                )
            };
            return {
                ...head,
                etag: normalizeOpaqueTag(head.etag)
            };
        }

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
        if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            const [stat, stream] = await Promise.all([
                this.storageService.getStat(bucket, objectKey),
                this.storageService.getStream(bucket, objectKey)
            ]);

            return {
                stream,
                contentLength: stat.size,
                contentType: stat.mimetype,
                contentEncoding: readStringMetadata(stat, 'Content-Encoding') ?? readStringMetadata(stat, 'content-encoding'),
                etag: normalizeOpaqueTag(stat.etag),
                lastModified: stat.lastModified,
                metadata: Object.fromEntries(
                    Object.entries(stat)
                        .filter(([key, value]) => key.startsWith('x-amz-meta-') && typeof value === 'string')
                        .map(([key, value]) => [key.slice('x-amz-meta-'.length), value as string])
                )
            };
        }

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
        if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            await this.storageService.upload(bucket, objectKey, object.stream, buildLocalUploadMetadata(object));
            return;
        }

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
        if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            await this.storageService.deleteByPrefix(bucket, prefix);
            return;
        }

        await this.objectGatewayClient.deleteByPrefix(ownerClusterId, bucket, prefix);
    }

    private async publishTransferJobProjection(job: ClusterTransferJob): Promise<void> {
        try {
            const projectionContext = await this.resolveTransferJobProjectionContext(job);
            const status = mapTransferStateToJobStatus(job.props.state);

            await this.eventBus.publish(new JobStatusChangedEvent({
                jobId: job.id,
                teamId: job.props.team,
                status,
                queueType: CLUSTER_TRANSFER_QUEUE_TYPE,
                metadata: {
                    jobId: job.id,
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
                }
            }));
        } catch (error) {
            logger.warn({
                action: 'cluster.transfer.projected-job.failed',
                transferJobId: job.id,
                scopeType: job.props.scopeType,
                scopeId: job.props.scopeId,
                error
            }, 'Failed to project cluster transfer job into team jobs history');
        }
    }

    private async resolveTransferJobProjectionContext(
        job: ClusterTransferJob
    ): Promise<TransferJobProjectionContext> {
        if (job.props.scopeType === 'trajectory') {
            const trajectory = await this.trajectoryRepository.findById(job.props.scopeId, {
                select: ['name']
            });

            return {
                trajectoryId: job.props.scopeId,
                trajectoryName: trajectory?.props.name || `Trajectory ${job.props.scopeId}`
            };
        }

        if (job.props.scopeType === 'analysis') {
            const analysis = await this.analysisRepository.findById(job.props.scopeId, {
                select: ['trajectory']
            });
            const trajectoryId = analysis?.props.trajectory;

            if (trajectoryId) {
                const trajectory = await this.trajectoryRepository.findById(trajectoryId, {
                    select: ['name']
                });

                return {
                    trajectoryId,
                    trajectoryName: trajectory?.props.name || `Trajectory ${trajectoryId}`,
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
        const updatedJob = await this.clusterTransferJobRepository.updateRuntimeState(jobId, {
            ...data,
            state,
            updatedAt: new Date()
        });

        if (!updatedJob) {
            throw ApplicationError.notFound('ClusterTransferJob::NotFound', 'Cluster transfer job not found during update');
        }

        if (options.publishUpdate) {
            await this.publishTransferJobProjection(updatedJob);
        }

        return updatedJob;
    }
}
