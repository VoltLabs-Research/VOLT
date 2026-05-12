import type { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';
import { registerStatusTriple } from '@/core/reverse-channel/infrastructure/events/register-status-triple';
import {
    createGlbJobStatusDedupeKey,
    createGlbJobStatusMessage,
    createRasterJobStatusDedupeKey,
    createRasterJobStatusMessage
} from '@/modules/trajectory/contracts/reverse-channel-trajectory';
import {
    GlbCompletedEvent,
    GlbFailedEvent,
    GlbStartedEvent,
    RasterCompletedEvent,
    RasterFailedEvent,
    RasterStartedEvent
} from '@/modules/trajectory/domain/events';

export const registerTrajectoryEventMappers = (bridge: DomainEventBridge): void => {
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

};
