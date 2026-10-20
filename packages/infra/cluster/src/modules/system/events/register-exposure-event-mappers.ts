import type { DomainEventBridge, EventMapperSet } from '@shared/events/DomainEventBridge';
import { createExposureSnapshotMessage } from '@shared/contracts/types/container-types';
import { ExposureSnapshotUpdatedEvent } from '@modules/system/events/exposure-events';

export const registerExposureEventMappers: EventMapperSet = (bridge: DomainEventBridge): void => {
    bridge.register(ExposureSnapshotUpdatedEvent, (payload) => ({
        kind: 'immediate',
        message: createExposureSnapshotMessage(payload)
    }));
};
