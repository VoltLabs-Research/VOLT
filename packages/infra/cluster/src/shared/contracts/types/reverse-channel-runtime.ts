import type { RuntimeProgressEvent, TeamClusterDaemonRuntimeProgressPayload } from '@voltstack/daemon-cluster-client';

export type RuntimeProgressPayload = RuntimeProgressEvent;

export type RuntimeProgressMessage = TeamClusterDaemonRuntimeProgressPayload;

export const createRuntimeProgressMessage = (
    payload: RuntimeProgressPayload
): RuntimeProgressMessage => ({
    type: 'runtime-progress',
    ...payload
});
