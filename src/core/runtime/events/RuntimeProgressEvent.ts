import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { RuntimeProgressEvent as DaemonRuntimeProgressEvent } from '@voltstack/daemon-cluster-client';

type RuntimeProgressPayload = NonNullable<DaemonRuntimeProgressEvent['payload']>;
type RuntimeProgressStage = DaemonRuntimeProgressEvent['stage'];

export interface RuntimeProgressEventData {
    action: string;
    payload?: RuntimeProgressPayload;
    stage: RuntimeProgressStage;
    timestamp: string;
}

export class RuntimeProgressEvent extends BaseDomainEvent<RuntimeProgressEventData> {
    static readonly eventName = 'runtime.progress';

    constructor(payload: RuntimeProgressEventData) {
        super(RuntimeProgressEvent.eventName, payload);
    }
}
