import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';

export interface GlbStartedEventData {
    jobId: string;
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
}

export class GlbStartedEvent extends BaseDomainEvent<GlbStartedEventData> {
    static readonly eventName = 'trajectory.glb.started';

    constructor(payload: GlbStartedEventData) {
        super(GlbStartedEvent.eventName, payload);
    }
}
