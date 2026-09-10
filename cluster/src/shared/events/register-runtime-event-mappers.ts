import type { DomainEventBridge, EventMapperSet } from '@shared/events/DomainEventBridge';
import { OrchestrationAction } from '@shared/contracts/types/http-runtime';
import { createRuntimeProgressMessage } from '@shared/contracts/types/reverse-channel-runtime';
import { RuntimeProgressEvent } from '@shared/events/runtime-events';

export const registerRuntimeEventMappers: EventMapperSet = (bridge: DomainEventBridge): void => {
    bridge.register(RuntimeProgressEvent, (payload) => {
        if (payload.action !== OrchestrationAction.ContainerCreate) {
            return null;
        }

        return {
            kind: 'immediate',
            message: createRuntimeProgressMessage(payload)
        };
    });
};
