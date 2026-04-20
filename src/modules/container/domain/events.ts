import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { ExposureSnapshotPayload } from '@/modules/container/contracts/container-types';

export const ExposureSnapshotUpdatedEvent = createDomainEvent<ExposureSnapshotPayload>('container.exposure-snapshot-updated');
