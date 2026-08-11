import { errorMessage } from '@shared/application/utilities/error-message';
import { logger } from '@shared/infrastructure/logger';
import type { WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import type { PluginExecutionRuntime } from '@shared/contracts/types/plugin-execution';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import {
    resolveEntrypointArgs,
    type ResolvedWorkflowEntrypointArgs
} from '@modules/analysis/services/workflow/nodes/entrypoint-arguments';
import {
    resolveEntrypointConfig,
    type WorkflowEntrypointExecutionRequest
} from '@modules/analysis/services/workflow/nodes/entrypoint-config';
import {
    buildEntrypointNodeOutput,
    resolveNonZeroExitMessage
} from '@modules/analysis/services/workflow/nodes/entrypoint-process-outcome';
import { runPersistentEntrypoint } from '@modules/analysis/services/workflow/nodes/persistent-entrypoint-runner';
import fs from 'node:fs/promises';

export class WorkflowEntrypointHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Entrypoint;

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowNodeOutput> {
        const execution = context.execution?.entrypoint;
        if (!execution) {
            throw new Error(`Entrypoint ${node.id} cannot be executed without workflow execution context`);
        }

        return this.executeResolvedEntrypoint({
            context,
            node,
            entrypoint: resolveEntrypointConfig(node, execution),
            execution
        });
    }

    private async executeResolvedEntrypoint(
        request: WorkflowEntrypointExecutionRequest
    ): Promise<WorkflowNodeOutput> {
        const { context, node, entrypoint, execution } = request;
        const executionRuntime = await execution.pluginBinaryCache.getExecutionRuntime(entrypoint);
        const previousNodeOutput = context.outputs.get(node.id);

        context.outputs.set(node.id, {
            ...previousNodeOutput,
            projectPath: executionRuntime.projectPath
        });

        try {
            const preparedArgs = resolveEntrypointArgs(request);

            return await runPersistentEntrypoint(request, executionRuntime, preparedArgs)
                ?? await this.executeSubprocessEntrypoint(request, executionRuntime, preparedArgs);
        } catch (error: unknown) {
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

    private async executeSubprocessEntrypoint(
        { entrypoint, execution }: WorkflowEntrypointExecutionRequest,
        executionRuntime: PluginExecutionRuntime,
        preparedArgs: ResolvedWorkflowEntrypointArgs
    ): Promise<WorkflowNodeOutput> {
        const args = [...executionRuntime.argsPrefix, ...preparedArgs.args];
        const result = await execution.binaryExecutorService.executeProcess({
            jobId: execution.jobId,
            commandPath: executionRuntime.commandPath,
            args,
            cwd: execution.outputDir,
            env: executionRuntime.env,
            logSink: execution.logSink
        });

        if (result.code !== 0 && execution.nonZeroExitMessage) {
            throw new Error(resolveNonZeroExitMessage(execution.nonZeroExitMessage, result));
        }

        return buildEntrypointNodeOutput({
            entrypoint,
            executionRuntime,
            execution,
            args,
            resolvedArguments: preparedArgs.resolvedArguments,
            result,
            extraOutput: {
                outputFiles: execution.includeOutputFiles
                    ? await fs.readdir(execution.outputDir).catch((error) => {
                        logger.warn(`Failed to list entrypoint output dir ${execution.outputDir}: ${errorMessage(error)}`);
                        return [];
                    })
                    : undefined
            }
        });
    }
}
