import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface TrajectoryDeletedEventPayload {
    trajectoryId: string;
    teamId: string;
}

export default class TrajectoryDeletedEvent extends BaseDomainEvent<TrajectoryDeletedEventPayload> {
    constructor(payload: TrajectoryDeletedEventPayload) {
        super('trajectory.deleted', payload);
    }
}
