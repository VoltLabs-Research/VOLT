import { CascadeDeleteEachOnEntityDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnEntityDeletedHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';

interface IdentifiableEntity {
    readonly _id: string;
};

export abstract class CascadeDeleteEachOnTrajectoryDeletedHandler<TEntity extends IdentifiableEntity>
    extends CascadeDeleteEachOnEntityDeletedHandler<TrajectoryDeletedEvent, TEntity> {
    protected readonly payloadKey = 'trajectoryId';
    protected readonly filterField = 'trajectory';
};
