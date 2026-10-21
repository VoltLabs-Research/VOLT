import type { ExecutionLogSegment } from '@volt/contracts/modules/cluster/daemon-events';

type ExecutionLogStream = ExecutionLogSegment['stream'];

export type ExecutionLogSegmentMetadata = Omit<ExecutionLogSegment, 'occurredAt' | 'stream' | 'text'>;

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
