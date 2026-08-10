import { createDomainEvent } from '@shared/domain/events/createDomainEvent';
import type { RuntimeProgressPayload } from '@shared/contracts/types/reverse-channel-runtime';

export const RuntimeProgressEvent = createDomainEvent<RuntimeProgressPayload>('runtime.progress');
