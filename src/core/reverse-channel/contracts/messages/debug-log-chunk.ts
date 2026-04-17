export interface DebugLogChunkMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export interface DebugLogChunkSegment {
    executionPath?: string[];
    nodeId?: string;
    nodeLabel?: string;
    nodeType?: string;
    occurredAt: string;
    pluginId?: string;
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
}

export interface DebugLogChunkPayload {
    nodeId: string;
    segments: DebugLogChunkSegment[];
    sessionId: string;
}

export interface DebugLogChunkMessage extends DebugLogChunkMessageContext, DebugLogChunkPayload {
    type: 'debug-log-chunk';
}

export const createDebugLogChunkMessage = (
    context: DebugLogChunkMessageContext,
    payload: DebugLogChunkPayload
): DebugLogChunkMessage => ({
    type: 'debug-log-chunk',
    ...context,
    ...payload
});
