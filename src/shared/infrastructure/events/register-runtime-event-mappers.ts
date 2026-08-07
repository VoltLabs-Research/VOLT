import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import { registerEventMapperSet } from '@shared/infrastructure/events/event-mapper-registry';
import { OrchestrationAction } from '@shared/contracts/types/http-runtime';
import { createRuntimeProgressMessage } from '@shared/contracts/types/reverse-channel-runtime';
import { RuntimeProgressEvent } from '@shared/domain/events/runtime-events';

export const registerRuntimeEventMappers = registerEventMapperSet((bridge: DomainEventBridge): void => {
    bridge.register(RuntimeProgressEvent, (payload) => {
        if (payload.action !== OrchestrationAction.ContainerCreate) {
            return null;
        }

        return {
            kind: 'immediate',
            message: createRuntimeProgressMessage(payload)
        };
    });
});
