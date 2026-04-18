type ExecutionLogStream = 'stdout' | 'stderr' | 'system';

export interface ExecutionLogSegmentMetadata {
    executionPath?: string[];
    nodeId?: string;
    nodeLabel?: string;
    nodeType?: string;
    pluginId?: string;
}

export interface ExecutionLogSegment extends ExecutionLogSegmentMetadata {
    occurredAt: string;
    stream: ExecutionLogStream;
    text: string;
}
