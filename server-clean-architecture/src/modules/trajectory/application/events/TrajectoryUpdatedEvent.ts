import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { TrajectoryStatus, TrajectoryStats, TrajectoryFrame } from '@modules/trajectory/domain/entities/Trajectory';

export interface TrajectoryUpdatedEventData {
    trajectoryId: string;
    teamId: string;
    updates: {
        status?: TrajectoryStatus;
        stats?: Partial<TrajectoryStats>;
        frames?: TrajectoryFrame[];
    };
    updatedAt: Date;
}

export default class TrajectoryUpdatedEvent implements IDomainEvent {
    readonly eventId: string;
    readonly name = 'trajectory.updated';
    readonly occurredOn: Date;

    constructor(public readonly data: TrajectoryUpdatedEventData) {
        this.eventId = `trajectory.updated-${data.trajectoryId}-${Date.now()}`;
        this.occurredOn = new Date();
    }
}
