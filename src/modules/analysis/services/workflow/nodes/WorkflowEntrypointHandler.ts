import type { BinaryExecutorService, PersistentPluginInvocationInput } from '@modules/plugin/services/runtime/BinaryExecutorService';
import type { EntrypointType } from '@shared/contracts/types/http-runtime';
import { EntrypointType as EntrypointTypeEnum } from '@shared/contracts/types/http-runtime';
import type { WorkflowDefinition, WorkflowEntrypointData } from '@shared/contracts';
import { WORKFLOW_NODE_PHASE, type WorkflowNodeHandler } from '@modules/analysis/services/workflow/NodeRegistry';
import type { PluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import { WorkflowValueResolver } from '@modules/analysis/services/workflow/WorkflowValueResolver';
import type {
    WorkflowEntrypointConfigDefaults,
    WorkflowEntrypointExecutionOptions,
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowPreparedEntrypointArgs
} from '@shared/contracts/types/workflow.types';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import { decodeCliArgumentsToken } from '@shared/application/utilities/serialization';
import {
    buildInferFromContextArgs,
    collectInferFromContextArgumentKeys
} from '@modules/analysis/services/pipeline-context';
import { isRecord } from '@shared/domain/utilities/is-record';
import type {
    PluginFrameDescriptor,
    PluginProcessResponse
} from '@shared/contracts/types/plugin-batch';
import type { SharedFramePublishInput } from '@modules/plugin/services/runtime/SharedMemoryBridge';
import type { TypedColumn } from '@modules/trajectory/services/storage/TrajectoryFrameStore';
import fs from 'node:fs/promises';

const PERSISTENT_PLUGIN_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const inferFromContextKeysCache = new WeakMap<WorkflowDefinition, string[]>();

const getInferFromContextArgumentKeys = (definition: WorkflowDefinition): string[] => {
    let keys = inferFromContextKeysCache.get(definition);
    if (keys === undefined) {
        keys = collectInferFromContextArgumentKeys(definition);
        inferFromContextKeysCache.set(definition, keys);
    }
    return keys;
};

type ProcessExecutionResult = Awaited<ReturnType<BinaryExecutorService['executeProcess']>>;

interface WorkflowEntrypointConfig {
    binaryObjectPath: string;
    ownerClusterId?: string;
    argumentsTemplate: string;
    entrypointType?: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
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
    readonly phase = WORKFLOW_NODE_PHASE[WorkflowNodeType.Entrypoint];

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
            ownerClusterId: entrypointData?.ownerClusterId ?? defaults?.ownerClusterId,
            argumentsTemplate,
            entrypointType,
            requirementsFile: entrypointData?.requirementsFile ?? defaults?.requirementsFile,
            entrypointScript: entrypointData?.entrypointScript ?? defaults?.entrypointScript
        };
    }

    private async executeResolvedEntrypoint(
        request: WorkflowEntrypointExecutionRequest
    ): Promise<WorkflowNodeOutput> {
        const { context, node, entrypoint, execution } = request;

        const executionRuntime = await execution.pluginBinaryCache.getExecutionRuntime({
            binaryObjectPath: entrypoint.binaryObjectPath,
            ownerClusterId: entrypoint.ownerClusterId,
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
                if (WorkflowEntrypointHandler.canUsePersistentPool(entrypoint.entrypointType, executionRuntime, execution)) {
                    return await this.executePersistentEntrypoint(request, executionRuntime, preparedArgs);
                }

                return await this.executePreparedEntrypoint(request, executionRuntime, preparedArgs);
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

    private static canUsePersistentPool(
        entrypointType: EntrypointType | undefined,
        executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>,
        execution: WorkflowEntrypointExecutionOptions
    ): boolean {
        if (entrypointType !== EntrypointTypeEnum.PythonScript) {
            return false;
        }
        if (!executionRuntime.projectPath) return false;

        if (!execution.trajectoryFrameStore || !execution.ownerClusterId) return false;

        return true;
    }

    private async executePersistentEntrypoint(
        request: WorkflowEntrypointExecutionRequest,
        executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>,
        preparedArgs: ResolvedWorkflowEntrypointArgs
    ): Promise<WorkflowNodeOutput> {
        const { context, entrypoint, execution } = request;
        const trajectoryFrameStore = execution.trajectoryFrameStore!;
        const ownerClusterId = execution.ownerClusterId!;
        const pluginRoot = executionRuntime.projectPath!;

        const timestep = context.selectedTimestep
            ?? context.selectedTimesteps?.[0]
            ?? context.trajectoryFrames?.[0]?.timestep;
        if (timestep === undefined) {
            return this.executePreparedEntrypoint(request, executionRuntime, preparedArgs);
        }

        const frame = await trajectoryFrameStore.readFrame({
            trajectoryId: context.trajectoryId,
            ownerClusterId,
            timestep
        });

        const config = WorkflowEntrypointHandler.buildPluginConfig(preparedArgs, context);
        const frameDescriptor: PluginFrameDescriptor = {
            timestep: frame.timestep,
            natoms: frame.atomCount,
            simulationCell: WorkflowEntrypointHandler.formatBbox(frame.frameBbox)
        };
        const shmFramePublish = WorkflowEntrypointHandler.buildSharedFramePublish(frame);

        const invocationInput: PersistentPluginInvocationInput = {
            pluginId: context.pluginId,
            pythonCommandPath: executionRuntime.commandPath,
            pluginRoot,
            entrypointScript: WorkflowEntrypointHandler.resolvePersistentEntrypointScript(entrypoint, executionRuntime),
            env: executionRuntime.env,
            logSink: execution.logSink,
            frame: frameDescriptor,
            shmFramePublish,
            config,
            mode: 'single',
            timeoutMs: PERSISTENT_PLUGIN_DEFAULT_TIMEOUT_MS
        };

        try {
            const invocation = await execution.binaryExecutorService.invokePersistentPlugin(invocationInput);
            return WorkflowEntrypointHandler.buildPersistentEntrypointOutput({
                entrypoint,
                executionRuntime,
                preparedArgs,
                execution,
                response: invocation.response
            });
        } catch (error) {
            const cause = error instanceof Error ? error : new Error(String(error));
            throw new Error(
                `Persistent plugin invocation failed for ${context.pluginId} (trajectory ${context.trajectoryId}, timestep ${timestep}): ${cause.message}`,
                { cause }
            );
        }
    }

    private static resolvePersistentEntrypointScript(
        entrypoint: WorkflowEntrypointConfig,
        executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>
    ): string {
        const scriptArg = executionRuntime.argsPrefix[0];
        if (scriptArg && scriptArg.length > 0) return scriptArg;
        if (entrypoint.entrypointScript) return entrypoint.entrypointScript;
        throw new Error('Persistent plugin invocation requires an entrypointScript');
    }

    private static buildPluginConfig(
        preparedArgs: ResolvedWorkflowEntrypointArgs,
        context?: WorkflowExecutionContext
    ): Record<string, unknown> {
        const trimmed = preparedArgs.resolvedArguments.trim();
        const base: Record<string, unknown> = {
            args: preparedArgs.args
        };
        if (context?.userConfig && Object.keys(context.userConfig).length > 0) {
            base.workflowConfig = context.userConfig;
        }
        if (!trimmed) return base;
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (isRecord(parsed)) {
                return { ...base, ...parsed };
            }
            return { ...base, config: parsed };
        } catch {
            return { ...base, raw: trimmed };
        }
    }

    private static buildSharedFramePublish(frame: {
        positions: Float32Array;
        types: Uint16Array;
        ids?: Uint32Array;
        properties: Record<string, TypedColumn>;
        atomCount: number;
    }): SharedFramePublishInput {
        const atomCount = frame.atomCount;
        const columns: SharedFramePublishInput['columns'] = [
            {
                name: 'positions',
                dtype: 'float32',
                shape: [atomCount, 3],
                data: frame.positions
            },
            {
                name: 'types',
                dtype: 'uint16',
                shape: [atomCount],
                data: frame.types
            }
        ];
        if (frame.ids) {
            columns.push({
                name: 'ids',
                dtype: 'uint32',
                shape: [atomCount],
                data: frame.ids
            });
        }
        for (const [propertyName, column] of Object.entries(frame.properties)) {
            columns.push({
                name: `properties/${propertyName}`,
                dtype: column.dtype === 'i32' ? 'int32' : 'float32',
                shape: [column.values.length],
                data: column.values
            });
        }
        return { columns };
    }

    private static formatBbox(bbox: readonly [number, number, number, number, number, number]): string {
        return bbox.join(',');
    }

    private static buildPersistentEntrypointOutput(params: {
        entrypoint: WorkflowEntrypointConfig;
        executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>;
        preparedArgs: ResolvedWorkflowEntrypointArgs;
        execution: WorkflowEntrypointExecutionOptions;
        response: PluginProcessResponse;
    }): WorkflowNodeOutput {
        const { entrypoint, executionRuntime, preparedArgs, execution, response } = params;
        const { binaryObjectPath } = entrypoint;
        const { artifactPath, commandPath, projectPath } = executionRuntime;

        if (!response.ok) {
            const errorMessage = response.error?.message ?? 'Persistent plugin returned error';
            const stderr = [errorMessage, response.error?.traceback ?? ''].filter(Boolean).join('\n');
            const exitCode = 1;

            if (execution.nonZeroExitMessage) {
                const message = typeof execution.nonZeroExitMessage === 'function'
                    ? execution.nonZeroExitMessage({ code: exitCode, stdout: '', stderr })
                    : execution.nonZeroExitMessage;
                throw new Error(message);
            }
            throw new Error(errorMessage);
        }

        return {
            binaryObjectPath,
            commandPath,
            artifactPath,
            args: preparedArgs.args,
            resolvedArguments: preparedArgs.resolvedArguments,
            outputPath: execution.outputDir,
            projectPath,
            exitCode: 0,
            stdout: WorkflowEntrypointHandler.serializePluginResult(response.result),
            stderr: '',
            pluginResult: WorkflowEntrypointHandler.coerceJsonCompatible(response.result),
            ...execution.extraOutput
        };
    }

    private static serializePluginResult(result: unknown): string {
        if (result === undefined || result === null) {
            return '';
        }
        if (typeof result === 'string') {
            return result;
        }
        try {
            return JSON.stringify(result);
        } catch {
            return String(result);
        }
    }

    private static coerceJsonCompatible(value: unknown): object | string | number | boolean | null {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'object'
            || typeof value === 'string'
            || typeof value === 'number'
            || typeof value === 'boolean') {
            return value;
        }
        return String(value);
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

        const inferFromContextArgs = context.pipelineContext
            ? buildInferFromContextArgs(
                context.pipelineContext,
                getInferFromContextArgumentKeys(context.workflow.definition)
            )
            : [];

        return {
            ...preparedArgs,
            args: [...preparedArgs.args, ...inferFromContextArgs],
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
