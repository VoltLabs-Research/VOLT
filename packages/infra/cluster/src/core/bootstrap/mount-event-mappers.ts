import { singleton } from '@shared/utilities/singleton';
import { DomainEventBridge } from '@shared/events/DomainEventBridge';
import { getEventDispatcher } from '@shared/events/EventDispatcher';
import { EVENT_MAPPER_SETS } from '@core/bootstrap/event-mappers';
import { getVoltEventChannelConnection } from '@modules/system/socket/connection/VoltEventChannelConnection';
import { logger } from '@shared/logger';

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
