import { ErrorCodes } from '@core/constants/error-codes';

import ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import { toClusterTransferJobLike, type ClusterTransferJob } from '@modules/cluster/contracts/cluster-transfer-job';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/team-cluster';
import {
    createClusterTransferJobDefaults,
    ClusterTransferJobReason as ClusterTransferJobReasonColumn,
    ClusterTransferJobState as ClusterTransferJobStateColumn
} from '@modules/cluster/contracts/cluster-transfer-job';
import type {
    ClusterTransferJobState
} from '@volt/contracts/modules/cluster/domain';
import { StoragePlacementScopeType as StoragePlacementScopeTypeColumn } from '@modules/cluster/contracts/storage-placement';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import { In, IsNull, LessThanOrEqual, Or } from 'typeorm';
import publishTransferJobProjection from '@modules/cluster/services/ClusterTransferJobProjector';
import {
    CLUSTER_TRANSFER_CLAIM_TTL_MS,
    CLUSTER_TRANSFER_WORKER_ID,
    OPEN_TRANSFER_JOB_STATES
} from '@modules/cluster/services/cluster-transfer-constants';

/**
 * Persistence and distributed claim leasing for cluster transfer jobs.
 */
export default class ClusterTransferJobStore{
    async findById(jobId: string): Promise<ClusterTransferJob | null> {
        const entity = await ClusterTransferJobEntity.findOneBy({ id: jobId });
        return entity ? toClusterTransferJobLike(entity) : null;
    }

    async setJobState(
        jobId: string,
        state: ClusterTransferJobState,
        data: Partial<ClusterTransferJob['props']> = {},
        options: {
            publishUpdate?: boolean;
        } = {}
    ): Promise<ClusterTransferJob> {
        const jobEntity = await ClusterTransferJobEntity.findOneBy({ id: jobId });
        if (!jobEntity) {
            throw ApplicationError.notFound(ErrorCodes.CLUSTER_TRANSFER_JOB_NOT_FOUND, 'Cluster transfer job not found during update');
        }

        const updatedJobEntity = await Object.assign(jobEntity, {
            ...this.#toJobEntityPatch(data),
            state: state as ClusterTransferJobStateColumn
        }).save();
        const updatedJob = toClusterTransferJobLike(updatedJobEntity);

        if (options.publishUpdate) {
            await publishTransferJobProjection(updatedJob);
        }

        return updatedJob;
    }

    #toJobEntityPatch(data: Partial<ClusterTransferJob['props']>): Partial<ClusterTransferJobEntity> {
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

    async createTransferJob(props: Partial<ClusterTransferJob['props']>): Promise<ClusterTransferJob> {
        const created = await ClusterTransferJobEntity.create({
            ...this.#toJobEntityPatch({
                ...createClusterTransferJobDefaults(),
                ...props
            })
        }).save();

        return toClusterTransferJobLike(created);
    }

    async findOpenTransferJobByScope(
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

    async claimNextRunnable(): Promise<ClusterTransferJob | null> {
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
            const claimed = await this.#tryClaimJob(candidate.id, now, claimExpiresAt);
            if (!claimed) {
                continue;
            }

            return claimed;
        }

        return null;
    }

    async #tryClaimJob(jobId: string, now: Date, claimExpiresAt: Date): Promise<ClusterTransferJob | null> {
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

        return this.findById(jobId);
    }

    async renewClaim(jobId: string, claimTtlMs: number): Promise<boolean> {
        const claimExpiresAt = new Date(Date.now() + claimTtlMs);
        const result = await ClusterTransferJobEntity.update({
            id: jobId,
            claimedBy: CLUSTER_TRANSFER_WORKER_ID
        }, { claimExpiresAt });

        return (result.affected ?? 0) > 0;
    }

    async releaseClaim(jobId: string): Promise<void> {
        await ClusterTransferJobEntity.update({
            id: jobId,
            claimedBy: CLUSTER_TRANSFER_WORKER_ID
        }, {
            claimedBy: null,
            claimExpiresAt: null
        });
    }

    async findTeamClusterById(clusterId: string): Promise<TeamCluster | null> {
        const entity = await TeamClusterEntity.findOneBy({ id: clusterId });
        return entity ? toTeamClusterLike(entity) : null;
    }
}
