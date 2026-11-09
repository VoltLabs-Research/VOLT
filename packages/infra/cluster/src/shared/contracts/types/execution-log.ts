import type { ExecutionLogSegment } from '@volt/contracts/modules/cluster/daemon-events';
import type { PluginProgressDirective } from '@volt/contracts/modules/plugin/progress';

type ExecutionLogStream = ExecutionLogSegment['stream'];

export type ExecutionLogSegmentMetadata = Omit<ExecutionLogSegment, 'occurredAt' | 'stream' | 'text'>;

export interface ProcessExecutionLogChunk {
    stream: ExecutionLogStream;
    text: string;
    occurredAt: string;
}

export interface ProcessExecutionLogSink {
    handleChunk(chunk: ProcessExecutionLogChunk): void | Promise<void>;
    // A @volt:progress or @volt:status line the plugin wrote; it is not part of the log text.
    handleProgress?(directive: PluginProgressDirective): void;
    flush?(): Promise<void>;
}

export type ProcessExecutionLogStream = ExecutionLogStream;
