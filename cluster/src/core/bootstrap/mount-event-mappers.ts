import { singleton } from '@shared/application/utilities/singleton';
import { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { EVENT_MAPPER_SETS } from '@core/bootstrap/event-mappers';
import { getVoltEventChannelConnection } from '@modules/container/socket/connection/VoltEventChannelConnection';
import { logger } from '@shared/infrastructure/logger';

/**
 * Builds the bridge every module's events cross to reach the control plane.
 *
 * The sets come from `EVENT_MAPPER_SETS` rather than from a registry filled by
 * import side effects, so an unmounted set is a compile-time-visible omission
 * instead of an event that quietly never arrives.
 */
export const getDomainEventBridge = singleton((): DomainEventBridge => {
    const bridge = new DomainEventBridge(getVoltEventChannelConnection());
    const sets = EVENT_MAPPER_SETS;

    /*
     * With no mappers the daemon still runs every job but reports none of them,
     * leaving the control plane's projection stuck at `queued` forever. That looks
     * like a frozen queue, so it is worth refusing to boot over.
     */
    if (sets.length === 0) {
        throw new Error('No event mapper sets are declared: check EVENT_MAPPER_SETS in @core/bootstrap/event-mappers');
    }

    for (const register of sets) {
        register(bridge);
    }

    bridge.subscribeAll(getEventDispatcher());
    logger.info(`@event-bootstrap: mounted ${sets.length} event mapper sets`);

    return bridge;
});
