import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { IMapper } from '@shared/infrastructure/persistence/IMapper';
import type { Document, FilterQuery, Model } from 'mongoose';

const RUNNABLE_JOB_SORT = {
    updatedAt: 1,
    createdAt: 1
} as const;

export abstract class MongooseClaimableJobRepository<
    TDomain,
    TProps,
    TDocument extends Document
> extends MongooseBaseRepository<TDomain, TProps, TDocument> {
    constructor(
        model: Model<TDocument>,
        mapper: IMapper<TDomain, TProps, TDocument>,
        private readonly openStates: readonly string[]
    ) {
        super(model, mapper);
    }

    async claimNextRunnable(workerId: string, claimTtlMs: number): Promise<TDomain | null> {
        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + claimTtlMs);

        const document = await this.model.findOneAndUpdate(
            {
                state: { $in: this.openStates },
                $or: [
                    { claimedBy: null },
                    { claimedBy: { $exists: false } },
                    { claimExpiresAt: null },
                    { claimExpiresAt: { $lte: now } }
                ]
            } as FilterQuery<TDocument>,
            {
                $set: {
                    claimedBy: workerId,
                    claimExpiresAt
                }
            },
            {
                new: true,
                sort: RUNNABLE_JOB_SORT
            }
        ).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async renewClaim(jobId: string, workerId: string, claimTtlMs: number): Promise<boolean> {
        const claimExpiresAt = new Date(Date.now() + claimTtlMs);
        const result = await this.model.updateOne(
            { _id: jobId, claimedBy: workerId } as FilterQuery<TDocument>,
            { $set: { claimExpiresAt } }
        ).exec();

        return result.modifiedCount > 0;
    }

    async releaseClaim(jobId: string, workerId: string): Promise<void> {
        await this.model.updateOne(
            { _id: jobId, claimedBy: workerId } as FilterQuery<TDocument>,
            { $set: { claimedBy: null, claimExpiresAt: null } }
        ).exec();
    }

    async updateRuntimeState(jobId: string, data: Partial<TProps>): Promise<TDomain | null> {
        return this.updateById(jobId, data);
    }
}
