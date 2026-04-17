import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';

export interface RasterStartedEventData {
    jobId: string;
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
}

export class RasterStartedEvent extends BaseDomainEvent<RasterStartedEventData> {
    static readonly eventName = 'trajectory.raster.started';

    constructor(payload: RasterStartedEventData) {
        super(RasterStartedEvent.eventName, payload);
    }
}
