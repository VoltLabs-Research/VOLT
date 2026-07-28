import type { RuntimeProgressEvent as DaemonRuntimeProgressEvent } from '@voltstack/daemon-cluster-client';

type RuntimeProgressPayloadData = NonNullable<DaemonRuntimeProgressEvent['payload']>;

export type RuntimeProgressStage = DaemonRuntimeProgressEvent['stage'];

export interface RuntimeProgressPayload {
    action: string;
    payload?: RuntimeProgressPayloadData;
    stage: RuntimeProgressStage;
    timestamp: string;
}

export type RuntimeProgressMessage = RuntimeProgressPayload & { type: 'runtime-progress' };

export const createRuntimeProgressMessage = (
    payload: RuntimeProgressPayload
): RuntimeProgressMessage => ({
    type: 'runtime-progress',
    ...payload
});
