import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import Trajectory, { TrajectoryFrame, TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import trajectoryMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryMapper';
import TrajectoryModel, { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import mongoose from 'mongoose';
import { inject } from 'tsyringe';

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

@Singleton()
export default class TrajectoryRepository
    extends MongooseBaseRepository<Trajectory, TrajectoryProps, TrajectoryDocument>
    implements ITrajectoryRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository
    ) {
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
            await this.eventBus.publish(new TrajectoryDeletedEvent({
                trajectoryId: id,
                teamId: result.team?.toString() || '',
                storageClusterId: resolveTrajectoryStorageClusterId({
                    storageClusterId: result.storageClusterId?.toString()
                }),
                userId: 'system',
                trajectoryName: result.name
            }));
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
};
