import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import trajectoryMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryMapper';
import TrajectoryModel, { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';

import { injectable, inject } from 'tsyringe';
import mongoose from 'mongoose';

@injectable()
export default class TrajectoryRepository
    extends MongooseBaseRepository<Trajectory, TrajectoryProps, TrajectoryDocument>
    implements ITrajectoryRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
        super(TrajectoryModel, trajectoryMapper);
    }

    async createWithId(id: string, data: Partial<TrajectoryProps>): Promise<Trajectory> {
        const created = await this.model.create({
            _id: new mongoose.Types.ObjectId(id),
            ...data
        });

        return trajectoryMapper.toDomain(created);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new TrajectoryDeletedEvent({
                trajectoryId: id,
                teamId: result.team?.toString() || '',
                userId: 'system',
                trajectoryName: result.name || 'Unknown Trajectory'
            }));
        }

        return !!result;
    }
};
