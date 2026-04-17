import fs from 'node:fs/promises';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import type { EntrypointType } from '@/contracts';
import type { WorkflowGraph } from '@/modules/analysis/contracts/workflow.types';
import { parseInlineWorkflowArguments } from '@/modules/analysis/application/workflow/InlineWorkflowShared';
import { resolveWorkflowTemplate } from '@/modules/analysis/application/workflow/WorkflowOutputResolution';

interface WorkflowEntrypointConfig {
    binaryObjectPath: string;
    argumentsTemplate: string;
    entrypointType?: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
    timeoutMs?: number;
}

interface PreparedWorkflowEntrypointArgs {
    args: string[];
    release?: () => void;
}

export interface WorkflowEntrypointExecutionInput {
    outputs: Map<string, Record<string, unknown>>;
    workflow: WorkflowGraph;
    nodeId: string;
    entrypoint: WorkflowEntrypointConfig;
    jobId: string;
    outputDir: string;
    pluginBinaryCacheService: PluginBinaryCacheService;
    binaryExecutorService: BinaryExecutorService;
    logSink?: ProcessExecutionLogSink;
    prepareArgs?: (args: string[]) => PreparedWorkflowEntrypointArgs;
    restoreOutputOnError?: boolean;
    includeOutputFiles?: boolean;
    extraOutput?: Record<string, unknown>;
    nonZeroExitMessage?: string | ((result: Awaited<ReturnType<BinaryExecutorService['executeProcess']>>) => string);
}

export const executeWorkflowEntrypoint = async (
    input: WorkflowEntrypointExecutionInput
): Promise<Record<string, unknown>> => {
    const executionRuntime = await input.pluginBinaryCacheService.getExecutionRuntime({
        binaryObjectPath: input.entrypoint.binaryObjectPath,
        entrypointType: input.entrypoint.entrypointType,
        requirementsFile: input.entrypoint.requirementsFile,
        entrypointScript: input.entrypoint.entrypointScript
    });
    const previousNodeOutput = input.outputs.get(input.nodeId);

    input.outputs.set(input.nodeId, {
        ...(previousNodeOutput ?? {}),
        projectPath: executionRuntime.projectPath ?? ''
    });

    try {
        const resolvedArguments = resolveWorkflowTemplate(
            input.entrypoint.argumentsTemplate,
            input.outputs,
            {
                workflow: input.workflow,
                currentNodeId: input.nodeId
            }
        );
        const parsedArgs = parseInlineWorkflowArguments(resolvedArguments);
        const preparedArgs = input.prepareArgs
            ? input.prepareArgs(parsedArgs)
            : { args: parsedArgs };

        try {
            const executionArgs = [...executionRuntime.argsPrefix, ...preparedArgs.args];
            const result = await input.binaryExecutorService.executeProcess({
                jobId: input.jobId,
                commandPath: executionRuntime.commandPath,
                args: executionArgs,
                cwd: input.outputDir,
                env: executionRuntime.env,
                timeoutMs: input.entrypoint.timeoutMs,
                logSink: input.logSink
            });

            if (result.code !== 0 && input.nonZeroExitMessage) {
                const message = typeof input.nonZeroExitMessage === 'function'
                    ? input.nonZeroExitMessage(result)
                    : input.nonZeroExitMessage;
                throw new Error(message);
            }

            const outputFiles = input.includeOutputFiles
                ? await fs.readdir(input.outputDir).catch(() => [])
                : undefined;

            return {
                binaryObjectPath: input.entrypoint.binaryObjectPath,
                commandPath: executionRuntime.commandPath,
                artifactPath: executionRuntime.artifactPath,
                args: executionArgs,
                resolvedArguments,
                outputPath: input.outputDir,
                projectPath: executionRuntime.projectPath ?? '',
                ...(outputFiles ? { outputFiles } : {}),
                exitCode: result.code,
                stdout: result.stdout,
                stderr: result.stderr,
                ...(input.extraOutput ?? {})
            };
        } finally {
            preparedArgs.release?.();
        }
    } catch (error) {
        if (!input.restoreOutputOnError) {
            throw error;
        }

        if (previousNodeOutput) {
            input.outputs.set(input.nodeId, previousNodeOutput);
        } else {
            input.outputs.delete(input.nodeId);
        }

        throw error;
    }
};
