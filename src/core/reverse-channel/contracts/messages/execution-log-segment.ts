export interface ExecutionLogSegmentMessage {
    executionPath?: string[];
    nodeId?: string;
    nodeLabel?: string;
    nodeType?: string;
    occurredAt: string;
    pluginId?: string;
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
}
