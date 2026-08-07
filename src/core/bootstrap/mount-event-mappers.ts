import { singleton } from '@shared/application/utilities/singleton';
import { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { getRegisteredEventMapperSets } from '@shared/infrastructure/events/event-mapper-registry';
import { getVoltEventChannelConnection } from '@modules/container/socket/connection/VoltEventChannelConnection';
import { logger } from '@shared/infrastructure/logger';

/**
 * Builds the bridge every module's events cross to reach the control plane.
 *
 * The mapper sets are collected by the registry as their files are imported, so
 * adding a set is creating its file rather than also remembering to list it here.
 */
export const getDomainEventBridge = singleton((): DomainEventBridge => {
    const bridge = new DomainEventBridge(getVoltEventChannelConnection());
    const sets = getRegisteredEventMapperSets();

    for (const register of sets) {
        register(bridge);
    }

    bridge.subscribeAll(getEventDispatcher());
    logger.info(`@event-bootstrap: mounted ${sets.length} event mapper sets`);

    return bridge;
});
