import type { RuntimeLifecycleEvent as RuntimeLifecycleEventPayload } from '@voltstack/daemon-cluster-client';
import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { RuntimeProgressPayload } from '@/core/runtime/contracts/reverse-channel-runtime';

export const RuntimeLifecycleEvent = createDomainEvent<RuntimeLifecycleEventPayload>('runtime.lifecycle');
export const RuntimeProgressEvent = createDomainEvent<RuntimeProgressPayload>('runtime.progress');