import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import { defineEventMapperSet } from '@shared/infrastructure/events/event-mapper-registry';
import { registerStatusTriple } from '@shared/infrastructure/events/register-status-triple';
import {
    createGlbJobStatusDedupeKey,
    createGlbJobStatusMessage,
    createRasterJobStatusDedupeKey,
    createRasterJobStatusMessage
} from '@shared/contracts/channel/reverse-channel-trajectory';
import {
    GlbCompletedEvent,
    GlbFailedEvent,
    GlbStartedEvent,
    RasterCompletedEvent,
    RasterFailedEvent,
    RasterStartedEvent
} from '@modules/trajectory/events/trajectory-events';

export const registerTrajectoryEventMappers = defineEventMapperSet((bridge: DomainEventBridge): void => {
    registerStatusTriple({
        bridge,
        events: {
            running: RasterStartedEvent,
            completed: RasterCompletedEvent,
            failed: RasterFailedEvent
        },
        buildMessage: createRasterJobStatusMessage,
        buildDedupeKey: createRasterJobStatusDedupeKey
    });

    registerStatusTriple({
        bridge,
        events: {
            running: GlbStartedEvent,
            completed: GlbCompletedEvent,
            failed: GlbFailedEvent
        },
        buildMessage: createGlbJobStatusMessage,
        buildDedupeKey: createGlbJobStatusDedupeKey
    });

});
