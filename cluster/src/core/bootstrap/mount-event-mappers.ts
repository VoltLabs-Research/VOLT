import { singleton } from '@shared/application/utilities/singleton';
import { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { EVENT_MAPPER_SETS } from '@core/bootstrap/event-mappers';
import { getVoltEventChannelConnection } from '@modules/container/socket/connection/VoltEventChannelConnection';
import { logger } from '@shared/infrastructure/logger';

export const getDomainEventBridge = singleton((): DomainEventBridge => {
    const bridge = new DomainEventBridge(getVoltEventChannelConnection());
    const sets = EVENT_MAPPER_SETS;

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
