import type { BinaryExecutorService } from '@/core/runtime/infrastructure/binary-executor-service';
import type { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import type { WorkflowEntrypointData } from '@/contracts';
import type { WorkflowNodeHandler } from '@/modules/analysis/application/workflow/NodeRegistry';
import type { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import { WorkflowValueResolver } from '@/modules/analysis/application/workflow/WorkflowValueResolver';
import type {
    WorkflowEntrypointConfigDefaults,
    WorkflowEntrypointExecutionOptions,
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowPreparedEntrypointArgs
} from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { decodeCliArgumentsToken } from '@/support/serialization/serialization';
import fs from 'node:fs/promises';

type ProcessExecutionResult = Awaited<ReturnType<BinaryExecutorService['executeProcess']>>;

interface WorkflowEntrypointConfig {
    binaryObjectPath: string;
    argumentsTemplate: string;
    entrypointType?: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
    timeoutMs?: number;
}

interface ResolveWorkflowEntrypointConfigInput {
    entrypointData?: WorkflowEntrypointData;
    defaults?: WorkflowEntrypointConfigDefaults;
    errorMessage: string;
    missingTypeMessage?: string;
    requireNonEmptyArguments?: boolean;
    requireEntrypointType?: boolean;
}

interface ResolvedWorkflowEntrypointArgs extends WorkflowPreparedEntrypointArgs {
    resolvedArguments: string;
}

interface BuildWorkflowEntrypointOutputInput {
    outputDir: string;
    entrypoint: WorkflowEntrypointConfig;
    extraOutput?: WorkflowNodeOutput;
    executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>;
    preparedArgs: ResolvedWorkflowEntrypointArgs;
    executionArgs: string[];
    result: ProcessExecutionResult;
    outputFiles?: string[];
}

interface WorkflowEntrypointExecutionRequest {
    context: WorkflowExecutionContext;
    node: WorkflowNode;
    entrypoint: WorkflowEntrypointConfig;
    execution: WorkflowEntrypointExecutionOptions;
}

export class WorkflowEntrypointHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Entrypoint;

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const execution = context.execution?.entrypoint;
        if (!execution) {
            throw new Error(`Entrypoint ${node.id} cannot be executed without workflow execution context`);
        }

        const entrypoint = WorkflowEntrypointHandler.resolveConfig({
            entrypointData: node.data.entrypoint,
            defaults: execution.defaults,
            errorMessage: execution.errorMessage ?? `Entrypoint ${node.id} is missing runtime configuration`,
            missingTypeMessage: execution.missingTypeMessage,
            requireNonEmptyArguments: execution.requireNonEmptyArguments,
            requireEntrypointType: execution.requireEntrypointType
        });

        return this.executeResolvedEntrypoint({
            context,
            node,
            entrypoint,
            execution
        });
    }

    private static resolveConfig({
        entrypointData,
        defaults,
        errorMessage,
        missingTypeMessage,
        requireNonEmptyArguments = false,
        requireEntrypointType = false
    }: ResolveWorkflowEntrypointConfigInput): WorkflowEntrypointConfig {
        const binaryObjectPath = entrypointData?.binaryObjectPath ?? defaults?.binaryObjectPath;
        const argumentsTemplate = entrypointData?.arguments ?? defaults?.argumentsTemplate;

        if (!binaryObjectPath || argumentsTemplate === undefined || (requireNonEmptyArguments && !argumentsTemplate)) {
            throw new Error(errorMessage);
        }

        const entrypointType = entrypointData?.type ?? defaults?.entrypointType;
        if (requireEntrypointType && !entrypointType) {
            throw new Error(missingTypeMessage ?? errorMessage);
        }

        return {
            binaryObjectPath,
            argumentsTemplate,
            entrypointType,
            requirementsFile: entrypointData?.requirementsFile ?? defaults?.requirementsFile,
            entrypointScript: entrypointData?.entrypointScript ?? defaults?.entrypointScript,
            timeoutMs: entrypointData?.timeout ?? defaults?.timeoutMs
        };
    }

    private async executeResolvedEntrypoint(
        request: WorkflowEntrypointExecutionRequest
    ): Promise<WorkflowNodeOutput> {
        const { context, node, entrypoint, execution } = request;
        const executionRuntime = await execution.pluginBinaryCache.getExecutionRuntime({
            binaryObjectPath: entrypoint.binaryObjectPath,
            entrypointType: entrypoint.entrypointType,
            requirementsFile: entrypoint.requirementsFile,
            entrypointScript: entrypoint.entrypointScript
        });
        const previousNodeOutput = context.outputs.get(node.id);

        context.outputs.set(node.id, {
            ...previousNodeOutput,
            projectPath: executionRuntime.projectPath
        });

        try {
            const preparedArgs = this.resolveEntrypointArgs(request);

            try {
                return this.executePreparedEntrypoint(request, executionRuntime, preparedArgs);
            } finally {
                preparedArgs.release?.();
            }
        } catch (error) {
            if (!execution.restoreOutputOnError) {
                throw error;
            }

            if (previousNodeOutput) {
                context.outputs.set(node.id, previousNodeOutput);
            } else {
                context.outputs.delete(node.id);
            }

            throw error;
        }
    }

    private parseInlineWorkflowArguments(value: string): string[] {
        if (!value) {
            return [];
        }

        const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
        const tokens = [...value.matchAll(regex)].map((match) => match[1] ?? match[2] ?? match[3]);

        return tokens.flatMap((token) => {
            const encodedArguments = decodeCliArgumentsToken(token);
            if (encodedArguments !== null) {
                return encodedArguments;
            }

            return [token];
        });
    }

    private resolveEntrypointArgs(request: WorkflowEntrypointExecutionRequest): ResolvedWorkflowEntrypointArgs {
        const { context, node, entrypoint, execution } = request;
        const { argumentsTemplate } = entrypoint;
        const resolvedArguments = new WorkflowValueResolver({
            outputs: context.outputs,
            workflow: context.workflow,
            context,
            currentNodeId: node.id
        }).resolveTemplate(argumentsTemplate);
        const parsedArgs = this.parseInlineWorkflowArguments(resolvedArguments);
        const preparedArgs = execution.prepareArgs
            ? execution.prepareArgs(parsedArgs)
            : { args: parsedArgs };

        return {
            ...preparedArgs,
            args: [...preparedArgs.args],
            resolvedArguments
        };
    }

    private buildWorkflowEntrypointOutput({
        outputDir,
        entrypoint,
        extraOutput,
        executionRuntime,
        preparedArgs,
        executionArgs,
        result,
        outputFiles
    }: BuildWorkflowEntrypointOutputInput): WorkflowNodeOutput {
        const { binaryObjectPath } = entrypoint;
        const { artifactPath, commandPath, projectPath } = executionRuntime;
        const { resolvedArguments } = preparedArgs;
        const { code: exitCode, stderr, stdout } = result;

        return {
            binaryObjectPath,
            commandPath,
            artifactPath,
            args: executionArgs,
            resolvedArguments,
            outputPath: outputDir,
            projectPath,
            outputFiles,
            exitCode,
            stdout,
            stderr,
            ...extraOutput
        };
    }

    private async executePreparedEntrypoint(
        request: WorkflowEntrypointExecutionRequest,
        executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>,
        preparedArgs: ResolvedWorkflowEntrypointArgs
    ): Promise<WorkflowNodeOutput> {
        const { entrypoint, execution } = request;
        const executionArgs = [...executionRuntime.argsPrefix, ...preparedArgs.args];
        const result = await execution.binaryExecutorService.executeProcess({
            jobId: execution.jobId,
            commandPath: executionRuntime.commandPath,
            args: executionArgs,
            cwd: execution.outputDir,
            env: executionRuntime.env,
            timeoutMs: entrypoint.timeoutMs,
            logSink: execution.logSink
        });

        if (result.code !== 0 && execution.nonZeroExitMessage) {
            const message = typeof execution.nonZeroExitMessage === 'function'
                ? execution.nonZeroExitMessage(result)
                : execution.nonZeroExitMessage;
            throw new Error(message);
        }

        const outputFiles = execution.includeOutputFiles
            ? await fs.readdir(execution.outputDir).catch(() => [])
            : undefined;

        return this.buildWorkflowEntrypointOutput({
            outputDir: execution.outputDir,
            entrypoint,
            extraOutput: execution.extraOutput,
            executionRuntime,
            preparedArgs,
            executionArgs,
            result,
            outputFiles
        });
    }
}
