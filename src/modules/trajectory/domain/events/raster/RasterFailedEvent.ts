import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { RasterStartedEventData } from '@/modules/trajectory/domain/events/raster/RasterStartedEvent';

export type RasterFailedEventData = RasterStartedEventData & { error: string };

export class RasterFailedEvent extends BaseDomainEvent<RasterFailedEventData> {
    static readonly eventName = 'trajectory.raster.failed';

    constructor(payload: RasterFailedEventData) {
        super(RasterFailedEvent.eventName, payload);
    }
}
