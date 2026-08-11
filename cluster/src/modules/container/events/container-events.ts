import { createDomainEvent } from '@shared/domain/events/create-domain-event';
import type { ExposureSnapshotPayload } from '@shared/contracts/types/container-types';

export const ExposureSnapshotUpdatedEvent = createDomainEvent<ExposureSnapshotPayload>('container.exposure-snapshot-updated');
