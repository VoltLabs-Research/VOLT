
import MongoListingReplicator from '@modules/cluster/services/MongoListingReplicator';
import ClusterTransferJobStore from '@modules/cluster/services/ClusterTransferJobStore';
import ClusterTransferJobProjector from '@modules/cluster/services/ClusterTransferJobProjector';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRedisRepository';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import { toClusterTransferJobLike, type ClusterTransferJob } from '@modules/cluster/contracts/domain/cluster-transfer-job';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/domain/team-cluster';
import {
    HARD_STORAGE_LIMIT_PCT,
    REBALANCE_TARGET_PCT,
    SOFT_STORAGE_LIMIT_PCT
} from '@shared/application/utilities/cluster-storage-policy';
import {
    createClusterTransferJobProps
} from '@modules/cluster/contracts/domain/cluster-transfer-job';
import type {
    ClusterTransferJobReason
} from '@volt/contracts/modules/cluster/domain';
import type { StoragePlacement } from '@modules/cluster/contracts/domain/storage-placement';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import objectGatewayClientSingleton from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import type { Readable } from 'node:stream';
import storagePlacementService from './StoragePlacementService';
import {
    CLUSTER_TRANSFER_CLAIM_RENEW_INTERVAL_MS,
    CLUSTER_TRANSFER_CLAIM_TTL_MS,
    TRANSFER_PROGRESS_FLUSH_EVERY_BYTES,
    TRANSFER_PROGRESS_FLUSH_EVERY_OBJECTS,
    isOpenTransferJobState
} from '@modules/cluster/services/cluster-transfer-constants';

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

class ClusterTransferCoordinator {
    private readonly storagePlacementService = storagePlacementService;
    private readonly systemMetricsRepository = systemMetricsRepository;
        private readonly mongoListings = new MongoListingReplicator();
        private readonly jobStore = new ClusterTransferJobStore();
        private readonly jobProjector = new ClusterTransferJobProjector();
    #objectGatewayClientCache?: ITeamClusterObjectGatewayClient;
    private get objectGatewayClient(): ITeamClusterObjectGatewayClient {
        return (this.#objectGatewayClientCache ??= objectGatewayClientSingleton);
    }

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

            const completedJob = await this.jobStore.createTransferJob(createClusterTransferJobProps({
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

            await this.jobProjector.publishTransferJobProjection(completedJob);

            return completedJob;
        }

        const openTransferJob = await this.jobStore.findOpenTransferJobByScope(input.scopeType, input.scopeId);
        if (openTransferJob && openTransferJob.props.destinationClusterId === input.destinationClusterId) {
            await this.jobProjector.publishTransferJobProjection(openTransferJob);
            return openTransferJob;
        }

        await this.assertTransferClusters(placement, input.destinationClusterId);

        let queuedJob: ClusterTransferJob;
        try {
            queuedJob = await this.jobStore.createTransferJob(createClusterTransferJobProps({
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
            const duplicate = await this.jobStore.findOpenTransferJobByScope(input.scopeType, input.scopeId);
            if (duplicate) {
                await this.jobProjector.publishTransferJobProjection(duplicate);
                return duplicate;
            }
            throw error;
        }

        await this.jobProjector.publishTransferJobProjection(queuedJob);

        return queuedJob;
    }

    async runPendingJobs(limit: number = 1): Promise<number> {
        let processedJobs = 0;

        while (processedJobs < limit) {
            const claimedJob = await this.jobStore.claimNextRunnable();
            if (!claimedJob) {
                break;
            }

            const renewTimer = setInterval(() => {
                void this.jobStore.renewClaim(
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
                await this.jobStore.releaseClaim(claimedJob.id).catch(() => undefined);
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

            const existingJob = await this.jobStore.findOpenTransferJobByScope(
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

        const startedJob = await this.jobStore.setJobState(job.id, 'freezing', {
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
            await this.mongoListings.replicateMongoListings(copiedJob);
            const switchingJob = await this.jobStore.setJobState(copiedJob.id, 'switching', {}, {
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

            finalizedJob = await this.jobStore.setJobState(switchingJob.id, 'cleaning', {}, {
                publishUpdate: true
            });
            const cleanupResult = await this.cleanupSourceCopy(
                job.props.sourceClusterId,
                placement.props.buckets,
                job.props.scopeType,
                job.props.scopeId
            );
            finalizedReplicaClusterIds = nextReplicaClusterIds.filter((clusterId) => clusterId !== job.props.sourceClusterId);
            finalizedJob = await this.jobStore.setJobState(finalizedJob.id, 'cleaning', {
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

            const completedJob = await this.jobStore.setJobState(finalizedJob.id, 'completed', {
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
            const failedJob = await this.jobStore.setJobState(job.id, 'failed', {
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

        let currentJob = await this.jobStore.setJobState(job.id, 'copying', {}, {
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
                currentJob = await this.jobStore.setJobState(currentJob.id, 'copying', {
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
        let currentJob = await this.jobStore.setJobState(job.id, 'verifying', {}, {
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

        currentJob = await this.jobStore.setJobState(currentJob.id, 'verifying', {
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

        const deletedMongoRows = await this.mongoListings.purgeMongoListings(sourceClusterId, scopeType, scopeId);

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
        const cluster = await this.jobStore.findTeamClusterById(clusterId);
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
        const cluster = await this.jobStore.findTeamClusterById(clusterId);
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


}

export default new ClusterTransferCoordinator();
