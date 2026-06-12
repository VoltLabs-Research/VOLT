import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events/TrajectoryDeletedPayload';

export type { TrajectoryDeletedEventPayload };

export default class TrajectoryDeletedEvent extends BaseDomainEvent<TrajectoryDeletedEventPayload> {
    constructor(payload: TrajectoryDeletedEventPayload) {
        super('trajectory.deleted', payload);
    }
}
