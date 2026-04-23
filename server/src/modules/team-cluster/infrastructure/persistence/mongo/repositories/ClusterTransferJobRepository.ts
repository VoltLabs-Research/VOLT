import type ClusterTransferJob from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import type { ClusterTransferJobProps, ClusterTransferJobState } from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import clusterTransferJobMapper from '@modules/team-cluster/infrastructure/persistence/mongo/mappers/ClusterTransferJobMapper';
import ClusterTransferJobModel, { ClusterTransferJobDocument } from '@modules/team-cluster/infrastructure/persistence/mongo/models/ClusterTransferJobModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { UpdateQuery } from 'mongoose';


const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobState[] = [
    'queued',
    'freezing',
    'copying',
    'verifying',
    'switching',
    'cleaning'
];

@Singleton()
export default class ClusterTransferJobRepository
    extends MongooseBaseRepository<ClusterTransferJob, ClusterTransferJobProps, ClusterTransferJobDocument> {

    constructor() {
        super(ClusterTransferJobModel, clusterTransferJobMapper);
    }

    async findOpenByScope(
        scopeType: ClusterTransferJobProps['scopeType'],
        scopeId: string
    ): Promise<ClusterTransferJob | null> {
        const document = await this.model.findOne({
            scopeType,
            scopeId,
            state: {
                $in: OPEN_TRANSFER_JOB_STATES
            }
        }).sort({
            createdAt: -1
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async findNextRunnable(): Promise<ClusterTransferJob | null> {
        const document = await this.model.findOne({
            state: {
                $in: OPEN_TRANSFER_JOB_STATES
            }
        }).sort({
            updatedAt: 1,
            createdAt: 1
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async claimNextRunnable(workerId: string, claimTtlMs: number): Promise<ClusterTransferJob | null> {
        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + claimTtlMs);

        const document = await this.model.findOneAndUpdate(
            {
                state: { $in: OPEN_TRANSFER_JOB_STATES },
                $or: [
                    { claimedBy: null },
                    { claimedBy: { $exists: false } },
                    { claimExpiresAt: null },
                    { claimExpiresAt: { $lte: now } }
                ]
            },
            {
                $set: {
                    claimedBy: workerId,
                    claimExpiresAt
                }
            },
            {
                new: true,
                sort: { updatedAt: 1, createdAt: 1 }
            }
        ).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async renewClaim(jobId: string, workerId: string, claimTtlMs: number): Promise<boolean> {
        const claimExpiresAt = new Date(Date.now() + claimTtlMs);
        const result = await this.model.updateOne(
            { _id: jobId, claimedBy: workerId },
            { $set: { claimExpiresAt } }
        ).exec();

        return result.modifiedCount > 0;
    }

    async releaseClaim(jobId: string, workerId: string): Promise<void> {
        await this.model.updateOne(
            { _id: jobId, claimedBy: workerId },
            { $set: { claimedBy: null, claimExpiresAt: null } }
        ).exec();
    }

    async listOpenByClusterIds(teamId: string, clusterIds: string[]): Promise<ClusterTransferJob[]> {
        const normalizedClusterIds = [...new Set(clusterIds.filter(Boolean))];

        if (normalizedClusterIds.length === 0) {
            return [];
        }

        const documents = await this.model.find({
            team: teamId,
            state: {
                $in: OPEN_TRANSFER_JOB_STATES
            },
            $or: [
                {
                    sourceClusterId: {
                        $in: normalizedClusterIds
                    }
                },
                {
                    destinationClusterId: {
                        $in: normalizedClusterIds
                    }
                }
            ]
        }).sort({
            updatedAt: -1,
            createdAt: -1
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async updateRuntimeState(
        jobId: string,
        data: Partial<ClusterTransferJobProps>
    ): Promise<ClusterTransferJob | null> {
        const persistenceData = this.mapper.toPersistence(data);
        const document = await this.model.findByIdAndUpdate(
            jobId,
            {
                $set: persistenceData
            } as UpdateQuery<ClusterTransferJobDocument>,
            {
                new: true
            }
        ).exec();

        return document ? this.mapper.toDomain(document) : null;
    }
}
