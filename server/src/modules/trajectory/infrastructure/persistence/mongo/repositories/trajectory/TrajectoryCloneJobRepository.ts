import TrajectoryCloneJob, { TrajectoryCloneJobProps, TrajectoryCloneJobState } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import trajectoryCloneJobMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryCloneJobMapper';
import TrajectoryCloneJobModel, { TrajectoryCloneJobDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryCloneJobModel';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { UpdateQuery } from 'mongoose';
import { injectable } from 'tsyringe';

const OPEN_CLONE_JOB_STATES: TrajectoryCloneJobState[] = [
    'queued',
    'preparing',
    'copying'
];

@injectable()
export default class TrajectoryCloneJobRepository
    extends MongooseBaseRepository<TrajectoryCloneJob, TrajectoryCloneJobProps, TrajectoryCloneJobDocument> {

    constructor() {
        super(TrajectoryCloneJobModel, trajectoryCloneJobMapper);
    }

    async findOpenByDestinationTrajectoryId(trajectoryId: string): Promise<TrajectoryCloneJob | null> {
        const document = await this.model.findOne({
            destinationTrajectoryId: trajectoryId,
            state: { $in: OPEN_CLONE_JOB_STATES }
        }).sort({ createdAt: -1 }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async claimNextRunnable(workerId: string, claimTtlMs: number): Promise<TrajectoryCloneJob | null> {
        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + claimTtlMs);

        const document = await this.model.findOneAndUpdate(
            {
                state: { $in: OPEN_CLONE_JOB_STATES },
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

    async updateRuntimeState(
        jobId: string,
        data: Partial<TrajectoryCloneJobProps>
    ): Promise<TrajectoryCloneJob | null> {
        const persistenceData = this.mapper.toPersistence(data);
        const document = await this.model.findByIdAndUpdate(
            jobId,
            {
                $set: persistenceData
            } as UpdateQuery<TrajectoryCloneJobDocument>,
            {
                new: true
            }
        ).exec();

        return document ? this.mapper.toDomain(document) : null;
    }
}
