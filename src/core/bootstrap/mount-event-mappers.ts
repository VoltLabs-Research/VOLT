import { getEnabledModules } from '@core/bootstrap/module-state';
import { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { registerRuntimeEventMappers } from '@shared/infrastructure/events/register-runtime-event-mappers';
import { getVoltEventChannelConnection } from '@modules/container/socket/connection/VoltEventChannelConnection';
import { registerAnalysisEventMappers } from '@modules/analysis/events/register-analysis-event-mappers';
import { registerContainerEventMappers } from '@modules/container/events/register-container-event-mappers';
import { registerPluginEventMappers } from '@modules/plugin/events/register-plugin-event-mappers';
import { registerTrajectoryEventMappers } from '@modules/trajectory/events/register-trajectory-event-mappers';
import { logger } from '@shared/infrastructure/logger';

interface EventMapperBinding {
    moduleKey: string | null;
    register: (bridge: DomainEventBridge) => void;
}

const EVENT_MAPPERS: readonly EventMapperBinding[] = [
    { moduleKey: null, register: registerRuntimeEventMappers },
    { moduleKey: 'container', register: registerContainerEventMappers },
    { moduleKey: 'analysis', register: registerAnalysisEventMappers },
    { moduleKey: 'plugin', register: registerPluginEventMappers },
    { moduleKey: 'trajectory', register: registerTrajectoryEventMappers }
];

let domainEventBridgeInstance: DomainEventBridge | null = null;

export const getDomainEventBridge = (): DomainEventBridge => {
    if (domainEventBridgeInstance) {
        return domainEventBridgeInstance;
    }

    const enabled = getEnabledModules();
    const bridge = new DomainEventBridge(getVoltEventChannelConnection());

    let mounted = 0;
    for (const { moduleKey, register } of EVENT_MAPPERS) {
        if (moduleKey !== null && !enabled.has(moduleKey)) {
            continue;
        }
        register(bridge);
        mounted += 1;
    }

    bridge.subscribeAll(getEventDispatcher());

    logger.info(`@event-bootstrap: mounted ${mounted}/${EVENT_MAPPERS.length} event mapper sets`);

    domainEventBridgeInstance = bridge;
    return domainEventBridgeInstance;
};
