import { DeleteManyOnEntityDeletedHandler } from '@shared/application/events/DeleteManyOnEntityDeletedHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';

export abstract class DeleteManyOnTrajectoryDeletedHandler extends DeleteManyOnEntityDeletedHandler<TrajectoryDeletedEvent> {
    protected readonly payloadKey = 'trajectoryId';
    protected readonly filterField = 'trajectory';
}
