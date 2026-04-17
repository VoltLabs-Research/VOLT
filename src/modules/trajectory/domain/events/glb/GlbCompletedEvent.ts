import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { GlbStartedEventData } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';

export interface GlbCompletedEventData extends GlbStartedEventData {}

export class GlbCompletedEvent extends BaseDomainEvent<GlbCompletedEventData> {
    static readonly eventName = 'trajectory.glb.completed';

    constructor(payload: GlbCompletedEventData) {
        super(GlbCompletedEvent.eventName, payload);
    }
}
