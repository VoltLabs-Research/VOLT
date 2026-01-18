import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/Trajectory';
import TrajectoryModel, { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/TrajectoryModel';
import trajectoryMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/TrajectoryMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable, inject } from 'tsyringe';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';

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