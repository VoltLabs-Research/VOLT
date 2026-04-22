import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { RuntimeProgressPayload } from '@/core/runtime/contracts/reverse-channel-runtime';

export const RuntimeProgressEvent = createDomainEvent<RuntimeProgressPayload>('runtime.progress');
