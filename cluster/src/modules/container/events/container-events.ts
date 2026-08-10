import { createDomainEvent } from '@shared/domain/events/createDomainEvent';
import type { ExposureSnapshotPayload } from '@shared/contracts/types/container-types';

export const ExposureSnapshotUpdatedEvent = createDomainEvent<ExposureSnapshotPayload>('container.exposure-snapshot-updated');
