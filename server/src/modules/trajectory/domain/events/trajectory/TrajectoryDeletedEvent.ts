import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events/TrajectoryDeletedPayload';

export type { TrajectoryDeletedEventPayload };

export default class TrajectoryDeletedEvent extends BaseDomainEvent<TrajectoryDeletedEventPayload> {
    constructor(payload: TrajectoryDeletedEventPayload) {
        super('trajectory.deleted', payload);
    }
}
