import type { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';
import { createExposureSnapshotMessage } from '@/modules/container/contracts/container-types';
import { ExposureSnapshotUpdatedEvent } from '@/modules/container/domain/events';

export const registerContainerEventMappers = (bridge: DomainEventBridge): void => {
    bridge.register(ExposureSnapshotUpdatedEvent, (payload) => ({
        kind: 'immediate',
        message: createExposureSnapshotMessage(payload)
    }));
};
