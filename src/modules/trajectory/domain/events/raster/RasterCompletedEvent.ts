import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { RasterStartedEventData } from '@/modules/trajectory/domain/events/raster/RasterStartedEvent';

export interface RasterCompletedEventData extends RasterStartedEventData {}

export class RasterCompletedEvent extends BaseDomainEvent<RasterCompletedEventData> {
    static readonly eventName = 'trajectory.raster.completed';

    constructor(payload: RasterCompletedEventData) {
        super(RasterCompletedEvent.eventName, payload);
    }
}
