import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { GlbStartedEventData } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';

export type GlbCompletedEventData = GlbStartedEventData;

export class GlbCompletedEvent extends BaseDomainEvent<GlbCompletedEventData> {
    static readonly eventName = 'trajectory.glb.completed';

    constructor(payload: GlbCompletedEventData) {
        super(GlbCompletedEvent.eventName, payload);
    }
}
