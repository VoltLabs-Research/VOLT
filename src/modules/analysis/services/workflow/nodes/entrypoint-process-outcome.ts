import type { PluginExecutionRuntime, ProcessExecutionResult } from '@shared/contracts/types/plugin-execution';
import type { WorkflowEntrypointExecutionOptions, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowEntrypointConfig } from '@modules/analysis/services/workflow/nodes/entrypoint-config';

interface EntrypointNodeOutputInput {
    entrypoint: WorkflowEntrypointConfig;
    executionRuntime: PluginExecutionRuntime;
    execution: WorkflowEntrypointExecutionOptions;
    args: string[];
    resolvedArguments: string;
    result: ProcessExecutionResult;
    extraOutput?: WorkflowNodeOutput;
}

export const resolveNonZeroExitMessage = (
    nonZeroExitMessage: NonNullable<WorkflowEntrypointExecutionOptions['nonZeroExitMessage']>,
    result: ProcessExecutionResult
): string => (typeof nonZeroExitMessage === 'function' ? nonZeroExitMessage(result) : nonZeroExitMessage);

/**
 * The node output shared by both execution paths: the persistent plugin pool reports
 * its outcome as a synthetic `ProcessExecutionResult` so the record stays identical.
 */
export const buildEntrypointNodeOutput = ({
    entrypoint,
    executionRuntime,
    execution,
    args,
    resolvedArguments,
    result,
    extraOutput
}: EntrypointNodeOutputInput): WorkflowNodeOutput => ({
    binaryObjectPath: entrypoint.binaryObjectPath,
    commandPath: executionRuntime.commandPath,
    artifactPath: executionRuntime.artifactPath,
    args,
    resolvedArguments,
    outputPath: execution.outputDir,
    projectPath: executionRuntime.projectPath,
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    ...extraOutput,
    ...execution.extraOutput
});
