import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import Trajectory, { TrajectoryFrame, TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import trajectoryMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryMapper';
import TrajectoryModel, { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import mongoose from 'mongoose';

const extractFrames = <T extends { frames?: TrajectoryFrame[] } | undefined>(
    data: T
): { sanitized: T; frames: TrajectoryFrame[] | undefined } => {
    if (!data) {
        return { sanitized: data, frames: undefined };
    }

    // Why: `frames` lives in a dedicated collection now (see F2.S6 migration).
    // Strip it from the payload handed to the parent Trajectory document so the
    // Mongoose model never attempts to embed it again.
    const { frames, ...rest } = data as { frames?: TrajectoryFrame[] } & Record<string, unknown>;
    return {
        sanitized: rest as T,
        frames
    };
};

@Singleton(TRAJECTORY_TOKENS.TrajectoryRepository)
export default class TrajectoryRepository
    extends MongooseBaseRepository<Trajectory, TrajectoryProps, TrajectoryDocument>
    implements ITrajectoryRepository {

    constructor(private readonly trajectoryFrameRepository: TrajectoryFrameRepository) {
        super(TrajectoryModel, trajectoryMapper);
    }

    override async create(data: TrajectoryProps): Promise<Trajectory> {
        const { sanitized, frames } = extractFrames(data);
        const created = await super.create(sanitized as TrajectoryProps);

        if (frames && frames.length > 0) {
            await this.trajectoryFrameRepository.replaceFrames(created.id, frames);
        }

        return created;
    }

    override async updateById(
        id: string,
        data: Partial<TrajectoryProps>,
        options?: Parameters<MongooseBaseRepository<Trajectory, TrajectoryProps, TrajectoryDocument>['updateById']>[2]
    ): Promise<Trajectory | null> {
        const { sanitized, frames } = extractFrames(data);
        const updated = await super.updateById(id, sanitized, options);

        if (frames !== undefined) {
            await this.trajectoryFrameRepository.replaceFrames(id, frames);
        }

        return updated;
    }

    async createWithId(id: string, data: Partial<TrajectoryProps>): Promise<Trajectory> {
        const { sanitized, frames } = extractFrames(data as Partial<TrajectoryProps>);
        const created = await this.model.create({
            _id: new mongoose.Types.ObjectId(id),
            ...sanitized
        });

        if (frames && frames.length > 0) {
            await this.trajectoryFrameRepository.replaceFrames(id, frames);
        }

        return trajectoryMapper.toDomain(created);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.trajectoryFrameRepository.deleteByTrajectoryId(id).catch(() => 0);
        }

        return !!result;
    }

    async searchIdsByTeamAndName(teamId: string, search: string): Promise<string[]> {
        const normalizedSearch = search.trim();
        if (!normalizedSearch) {
            return [];
        }

        const regex = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const docs = await this.model.find({
            team: teamId,
            name: regex
        }).select('_id').lean().exec();

        return docs.map((doc) => doc._id.toString());
    }
}
