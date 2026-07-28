export type ExecutionLogStream = 'stdout' | 'stderr' | 'system';

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

export interface ProcessExecutionLogChunk {
    stream: ExecutionLogStream;
    text: string;
    occurredAt: string;
}

export interface ProcessExecutionLogSink {
    handleChunk(chunk: ProcessExecutionLogChunk): void | Promise<void>;
    flush?(): Promise<void>;
}

export type ProcessExecutionLogStream = ExecutionLogStream;
