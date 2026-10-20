import { createDomainEvent } from '@shared/events/create-domain-event';
import type { ExposureSnapshotPayload } from '@shared/contracts/types/container-types';

export const ExposureSnapshotUpdatedEvent = createDomainEvent<ExposureSnapshotPayload>('container.exposure-snapshot-updated');
