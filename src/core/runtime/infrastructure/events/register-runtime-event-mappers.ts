import type { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';
import { OrchestrationAction } from '@/core/runtime/contracts/http-runtime';
import { createRuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import { RuntimeProgressEvent } from '@/core/runtime/domain/events';

export const registerRuntimeEventMappers = (bridge: DomainEventBridge): void => {
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
