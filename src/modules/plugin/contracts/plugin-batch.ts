export type PluginProtocolOpcode =
    | 'process'
    | 'process_batch'
    | 'ping'
    | 'warmup';

export interface PluginFrameBindingMetadata {
    kind: 'shm' | 'inline';
    shmPath?: string;
    size?: number;
    offset?: number;
    length?: number;
    dtype?: string;
}

export interface PluginFrameColumnBinding {
    name: string;
    dtype: string;
    shape: number[];
    binding: PluginFrameBindingMetadata;
}

export interface PluginFrameDescriptor {
    timestep: number;
    natoms: number;
    simulationCell?: string;
    columns?: PluginFrameColumnBinding[];
    payload?: unknown;
}

export interface PluginProcessRequest {
    opcode: PluginProtocolOpcode;
    frame?: PluginFrameDescriptor;
    frames?: PluginFrameDescriptor[];
    config?: Record<string, unknown>;
}

export interface PluginProcessResponse {
    ok: boolean;
    result?: unknown;
    results?: unknown[];
    error?: {
        message: string;
        type?: string;
        traceback?: string;
    };
}

export interface PluginBatchInvocationOptions {
    batchSize?: number;
    concurrency?: number;
}
