import { IEventHandler } from '@shared/application/events/IEventHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';

export abstract class DeleteManyOnTrajectoryDeletedHandler implements IEventHandler<TrajectoryDeletedEvent> {
    protected abstract readonly repository: { deleteMany(filter: any): Promise<any> };

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.repository.deleteMany({ trajectory: trajectoryId });
    }
}
