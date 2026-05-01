import type { BinaryExecutorService, PersistentPluginInvocationInput } from '@/core/runtime/infrastructure/binary-executor-service';
import type { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import { EntrypointType as EntrypointTypeEnum } from '@/core/runtime/contracts/http-runtime';
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
import { isPlainObject } from '@/support/type-guards/is-record';
import { getSharedWasmRuntime } from '@/modules/plugin/application/runtime/WasmRuntime';
import type { WasmFrameChunk } from '@/modules/plugin/application/runtime/WasmPluginInstance';
import type {
    PluginFrameDescriptor,
    PluginProcessResponse
} from '@/modules/plugin/contracts/plugin-batch';
import type { SharedFramePublishInput } from '@/modules/plugin/application/runtime/SharedMemoryBridge';
import fs from 'node:fs/promises';

const WASM_ENTRYPOINT_TYPE = 'wasm' as const;
const WASM_DEFAULT_TIMEOUT_MS = 30_000;
const PERSISTENT_PLUGIN_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

type ProcessExecutionResult = Awaited<ReturnType<BinaryExecutorService['executeProcess']>>;

interface WorkflowEntrypointConfig {
    binaryObjectPath: string;
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
            entrypointScript: entrypointData?.entrypointScript ?? defaults?.entrypointScript
        };
    }

    private async executeResolvedEntrypoint(
        request: WorkflowEntrypointExecutionRequest
    ): Promise<WorkflowNodeOutput> {
        const { context, node, entrypoint, execution } = request;

        if (WorkflowEntrypointHandler.isWasmEntrypoint(entrypoint.entrypointType)) {
            return this.executeWasmEntrypoint(request);
        }

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
        // Why: the pool only speaks the msgpack protocol to the Python stub,
        // and only plugins packaged as python-script or packaged-executable
        // can expose the `process(frame, config)` entrypoint. Raw executables
        // still need the legacy spawn path. Also require a projectPath (the
        // extracted plugin root where the user module lives).
        if (entrypointType !== EntrypointTypeEnum.PythonScript
            && entrypointType !== EntrypointTypeEnum.PackagedExecutable) {
            return false;
        }
        if (!executionRuntime.projectPath) return false;

        // Why: without the VtrReaderRegistry we cannot load a FrameChunk to
        // hand to the plugin; without an ownerClusterId the reader cannot
        // locate the trajectory in MinIO. Fall back to spawn which feeds the
        // plugin via CLI arguments + local dump files instead.
        if (!execution.vtrReaderRegistry || !execution.ownerClusterId) return false;

        // Why: python-script with no entrypointScript means a CLI script the
        // user invokes directly; the stub would have no user module to import.
        return true;
    }

    private async executePersistentEntrypoint(
        request: WorkflowEntrypointExecutionRequest,
        executionRuntime: Awaited<ReturnType<PluginBinaryCache['getExecutionRuntime']>>,
        preparedArgs: ResolvedWorkflowEntrypointArgs
    ): Promise<WorkflowNodeOutput> {
        const { context, entrypoint, execution } = request;
        const vtrReaderRegistry = execution.vtrReaderRegistry;
        const ownerClusterId = execution.ownerClusterId;
        if (!vtrReaderRegistry || !ownerClusterId) {
            // Defensive: canUsePersistentPool already guarded this. Fall back.
            return this.executePreparedEntrypoint(request, executionRuntime, preparedArgs);
        }

        const timestep = context.selectedTimestep
            ?? context.selectedTimesteps?.[0]
            ?? context.trajectoryFrames?.[0]?.timestep;
        if (typeof timestep !== 'number') {
            return this.executePreparedEntrypoint(request, executionRuntime, preparedArgs);
        }

        const reader = await vtrReaderRegistry.openReader({
            trajectoryId: context.trajectoryId,
            ownerClusterId
        });
        const frame = await reader.readFrame(timestep);
        const frameHash = await vtrReaderRegistry.getFrameHash({
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
        const binaryHash = executionRuntime.binaryHash
            ?? entrypoint.binaryObjectPath;

        const invocationInput: PersistentPluginInvocationInput = {
            pluginId: context.pluginId,
            pythonCommandPath: executionRuntime.commandPath,
            pluginRoot: executionRuntime.projectPath!,
            entrypointScript: WorkflowEntrypointHandler.resolvePersistentEntrypointScript(entrypoint, executionRuntime),
            env: executionRuntime.env,
            frame: frameDescriptor,
            shmFramePublish,
            config,
            mode: 'single',
            timeoutMs: PERSISTENT_PLUGIN_DEFAULT_TIMEOUT_MS,
            cache: {
                binaryHash,
                inputFrameHash: frameHash
            }
        };

        try {
            const invocation = await execution.binaryExecutorService.invokePersistentPlugin(invocationInput);
            return WorkflowEntrypointHandler.buildPersistentEntrypointOutput({
                entrypoint,
                executionRuntime,
                preparedArgs,
                execution,
                response: invocation.response,
                cacheHit: invocation.cacheHit === true,
                cacheKey: invocation.cacheKey
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
        // Why: the stub imports the user's module relative to pluginRoot. The
        // cache's argsPrefix holds the absolute scriptPath for python-script
        // entrypoints; for packaged-executable we fall back to the raw
        // entrypointScript (already a relative path within the project).
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
            if (isPlainObject(parsed)) {
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
        properties: Record<string, Float32Array>;
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
        for (const [propertyName, values] of Object.entries(frame.properties)) {
            columns.push({
                name: `properties/${propertyName}`,
                dtype: 'float32',
                shape: [values.length],
                data: values
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
        cacheHit: boolean;
        cacheKey?: string;
    }): WorkflowNodeOutput {
        const { entrypoint, executionRuntime, preparedArgs, execution, response, cacheHit, cacheKey } = params;
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
            pluginCacheHit: cacheHit,
            pluginCacheKey: cacheKey,
            ...execution.extraOutput
        };
    }

    private static serializePluginResult(result: unknown): string {
        if (result === undefined || result === null) return '';
        if (typeof result === 'string') return result;
        try {
            return JSON.stringify(result);
        } catch {
            return String(result);
        }
    }

    private static coerceJsonCompatible(value: unknown): object | string | number | boolean | null {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') return value;
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value;
        return String(value);
    }

    private static isWasmEntrypoint(entrypointType: EntrypointType | undefined): boolean {
        return entrypointType === WASM_ENTRYPOINT_TYPE;
    }

    private async executeWasmEntrypoint(
        request: WorkflowEntrypointExecutionRequest
    ): Promise<WorkflowNodeOutput> {
        const { context, node, entrypoint, execution } = request;
        const wasmRuntime = getSharedWasmRuntime();
        if (!wasmRuntime) {
            throw new Error(
                `WASM entrypoint for node ${node.id} cannot run: WasmRuntime singleton not initialized. `
                + 'Register the @Service(\'wasmRuntime\') via awilix before running wasm plugins.'
            );
        }

        const previousNodeOutput = context.outputs.get(node.id);
        try {
            const preparedArgs = this.resolveEntrypointArgs(request);
            try {
                const frame = WorkflowEntrypointHandler.resolveWasmFrame(context, node.id);
                const config = WorkflowEntrypointHandler.parseWasmConfig(preparedArgs.resolvedArguments);
                const startedAt = Date.now();
                const result = await wasmRuntime.execute({
                    binaryObjectPath: entrypoint.binaryObjectPath,
                    pluginId: context.pluginId,
                    frame,
                    config,
                    timeoutMs: WASM_DEFAULT_TIMEOUT_MS,
                    logSink: execution.logSink
                        ? (level, message) => {
                            void execution.logSink?.handleChunk({
                                stream: level === 'error' ? 'stderr' : 'stdout',
                                text: `${message}\n`,
                                occurredAt: new Date().toISOString()
                            });
                        }
                        : undefined
                });

                return {
                    binaryObjectPath: entrypoint.binaryObjectPath,
                    commandPath: entrypoint.binaryObjectPath,
                    artifactPath: entrypoint.binaryObjectPath,
                    args: preparedArgs.args,
                    resolvedArguments: preparedArgs.resolvedArguments,
                    outputPath: execution.outputDir,
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                    wasmResult: WorkflowEntrypointHandler.coerceJsonCompatible(result.value),
                    wasmDurationMs: result.durationMs,
                    wasmStartupMs: result.startupMs,
                    wasmTotalMs: Date.now() - startedAt,
                    ...execution.extraOutput
                };
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

    private static resolveWasmFrame(context: WorkflowExecutionContext, nodeId: string): WasmFrameChunk {
        // Why: the WASM entrypoint consumes a FrameChunk. We search upstream
        // node outputs for the nearest payload exposing positions/types, which
        // is how modifier/context nodes publish parsed trajectory slices.
        const visited = new Set<string>();
        const queue: string[] = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (!currentId || visited.has(currentId)) continue;
            visited.add(currentId);

            const output = context.outputs.get(currentId);
            if (output) {
                const frame = WorkflowEntrypointHandler.extractFrameFromOutput(output);
                if (frame) return frame;
            }

            for (const edge of context.workflow.getParentEdges(currentId)) {
                queue.push(edge.source);
            }
        }

        throw new Error(
            `WASM entrypoint ${nodeId}: no upstream node published a FrameChunk `
            + '(expected a payload with `positions: Float32Array` and `types: Uint16Array`).'
        );
    }

    private static extractFrameFromOutput(output: Record<string, unknown>): WasmFrameChunk | null {
        const positionsCandidate = output.positions ?? (output.frame as Record<string, unknown> | undefined)?.positions;
        const typesCandidate = output.types ?? (output.frame as Record<string, unknown> | undefined)?.types;
        if (!(positionsCandidate instanceof Float32Array) || !(typesCandidate instanceof Uint16Array)) {
            return null;
        }
        const propertiesCandidate = (output.properties ?? (output.frame as Record<string, unknown> | undefined)?.properties) as
            | Record<string, Float32Array>
            | undefined;
        const idsCandidate = (output.ids ?? (output.frame as Record<string, unknown> | undefined)?.ids) as Uint32Array | undefined;
        const timestepCandidate = (output.timestep ?? (output.frame as Record<string, unknown> | undefined)?.timestep) as number | undefined;

        return {
            atomCount: typesCandidate.length,
            positions: positionsCandidate,
            types: typesCandidate,
            properties: propertiesCandidate,
            ids: idsCandidate instanceof Uint32Array ? idsCandidate : undefined,
            timestep: typeof timestepCandidate === 'number' ? timestepCandidate : undefined
        };
    }

    private static parseWasmConfig(resolvedArguments: string): unknown {
        const trimmed = resolvedArguments.trim();
        if (!trimmed) return {};
        try {
            return JSON.parse(trimmed);
        } catch {
            return { raw: trimmed };
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
