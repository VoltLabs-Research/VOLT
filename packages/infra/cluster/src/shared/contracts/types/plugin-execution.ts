import type { EntrypointType } from '@shared/contracts/types/http-runtime';
import type {
    ProcessExecutionLogSink
} from '@shared/contracts/types/execution-log';
import type {
    PluginFrameDescriptor,
    PluginProcessResponse
} from '@shared/contracts/types/plugin-batch';
import type { SharedFramePublishInput } from '@shared/contracts/types/shared-frame';

export interface ProcessExecutionResult {
    code: number;
    stdout: string;
    stderr: string;
}

export interface ProcessExecutionInput {
    jobId: string;
    commandPath: string;
    args: string[];
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    logSink?: ProcessExecutionLogSink;
}

export interface PersistentPluginInvocationInput {
    pluginId: string;
    pythonCommandPath: string;
    pluginRoot: string;
    entrypointScript: string;
    env?: NodeJS.ProcessEnv;
    logSink?: ProcessExecutionLogSink;
    frame?: PluginFrameDescriptor;
    frames?: PluginFrameDescriptor[];
    shmFramePublish?: SharedFramePublishInput;
    config?: Record<string, unknown>;
    mode?: 'single' | 'batch';
    timeoutMs?: number;
}

export interface PersistentPluginInvocationResult {
    response: PluginProcessResponse;
}

export interface BinaryExecutor {
    executeProcess(input: ProcessExecutionInput): Promise<ProcessExecutionResult>;
    invokePersistentPlugin(input: PersistentPluginInvocationInput): Promise<PersistentPluginInvocationResult>;
}

export interface PluginExecutionRuntimeInput {
    binaryObjectPath: string;
    ownerClusterId?: string;
    entrypointType?: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
}

export interface PluginExecutionRuntime {
    artifactPath: string;
    commandPath: string;
    argsPrefix: string[];
    env?: NodeJS.ProcessEnv;
    projectPath?: string;
    binaryHash?: string;
}

export interface PluginRuntimeProvider {
    getExecutionRuntime(input: PluginExecutionRuntimeInput): Promise<PluginExecutionRuntime>;
}
