import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import trajectoryMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryMapper';
import TrajectoryModel, { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';

import { injectable, inject } from 'tsyringe';

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

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new TrajectoryDeletedEvent({
                trajectoryId: id,
                teamId: result.team?.toString()
            }));
        }

        return !!result;
    }
};