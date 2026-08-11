import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import type { EventMapperSet } from '@shared/infrastructure/events/event-mapper-registry';
import { createExposureSnapshotMessage } from '@shared/contracts/types/container-types';
import { ExposureSnapshotUpdatedEvent } from '@modules/container/events/container-events';

export const registerContainerEventMappers: EventMapperSet = (bridge: DomainEventBridge): void => {
    bridge.register(ExposureSnapshotUpdatedEvent, (payload) => ({
        kind: 'immediate',
        message: createExposureSnapshotMessage(payload)
    }));
};
