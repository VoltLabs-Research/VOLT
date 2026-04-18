import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { TimedTrajectoryJobEventData } from '@/modules/trajectory/domain/events/shared/trajectory-job-event-data';

export type GlbStartedEventData = TimedTrajectoryJobEventData;

export class GlbStartedEvent extends BaseDomainEvent<GlbStartedEventData> {
    static readonly eventName = 'trajectory.glb.started';

    constructor(payload: GlbStartedEventData) {
        super(GlbStartedEvent.eventName, payload);
    }
}
