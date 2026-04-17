import type { RuntimeLifecycleEvent as DaemonRuntimeLifecycleEvent } from '@voltstack/daemon-cluster-client';
import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';

export interface RuntimeLifecycleEventData extends DaemonRuntimeLifecycleEvent {}

export class RuntimeLifecycleEvent extends BaseDomainEvent<RuntimeLifecycleEventData> {
    static readonly eventName = 'runtime.lifecycle';

    constructor(payload: RuntimeLifecycleEventData) {
        super(RuntimeLifecycleEvent.eventName, payload);
    }
}
