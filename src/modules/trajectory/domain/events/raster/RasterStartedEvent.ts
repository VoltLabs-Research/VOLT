import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { TimedTrajectoryJobEventData } from '@/modules/trajectory/domain/events/shared/trajectory-job-event-data';

export type RasterStartedEventData = TimedTrajectoryJobEventData;

export class RasterStartedEvent extends BaseDomainEvent<RasterStartedEventData> {
    static readonly eventName = 'trajectory.raster.started';

    constructor(payload: RasterStartedEventData) {
        super(RasterStartedEvent.eventName, payload);
    }
}
