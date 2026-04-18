import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { GlbStartedEventData } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';

export type GlbFailedEventData = GlbStartedEventData & { error: string };

export class GlbFailedEvent extends BaseDomainEvent<GlbFailedEventData> {
    static readonly eventName = 'trajectory.glb.failed';

    constructor(payload: GlbFailedEventData) {
        super(GlbFailedEvent.eventName, payload);
    }
}
