import { createWorkflowExecutionContext, restoreWorkflowOutputs, snapshotWorkflowOutputs } from './WorkflowExecutionContextFactory';
import { resolveWorkflowTemplate } from './WorkflowOutputResolution';
import type { WorkflowNodeRegistry } from './NodeRegistry';
import {
    collectInlineExposureArtifacts,
    createNestedExecutionResult,
    parseInlineWorkflowArguments,
    readWorkflowEntrypointData,
    readWorkflowPluginNodeData,
    resolveInlinePluginExecutionOrder,
    type InlineWorkflowDumpTarget,
    type WorkflowEntrypointData,
    type WorkflowPluginNodeData
} from './InlineWorkflowShared';
import { WorkflowGraph, WorkflowNodeType, type WorkflowNode } from '../contracts';
import { EntrypointType, type NestedPluginDefinition, type PluginReferenceExecutionRequest, type WorkflowNodeDefinition } from '@/shared/contracts';
import { isRecord } from '@/shared/utils';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import fs from 'node:fs/promises';

interface NestedEntrypointContext {
    analysisId: string;
    pluginId: string;
}

interface TraceRuntimeContext {
    currentPluginId: string;
    nextTraceId: () => string;
}

interface InlineExecutionBaseInput {
    nestedPlugins: NestedPluginDefinition[];
    outputs: Map<string, Record<string, unknown>>;
    dumpTarget: InlineWorkflowDumpTarget;
    outputDir: string;
    trajectoryId: string;
    analysisId: string;
    teamId: string;
}

type InlinePluginNodeLike = Pick<WorkflowNodeDefinition, 'id' | 'type' | 'data'>;

export interface ExecuteInlinePluginNodeInput extends InlineExecutionBaseInput {
    node: InlinePluginNodeLike;
    captureTrace?: boolean;
}

export interface ExecuteInlinePluginReferenceInput extends InlineExecutionBaseInput {
    request: PluginReferenceExecutionRequest;
    captureTrace?: boolean;
}

interface NestedWorkflowExecutionResult {
    output: Record<string, unknown>;
    trace: InlineWorkflowTraceNode[];
}

export type InlineWorkflowTraceStatus = 'completed' | 'skipped' | 'error';

export interface InlineWorkflowTraceNode {
    traceId: string;
    nodeId: string;
    nodeType: string;
    status: InlineWorkflowTraceStatus;
    durationMs: number;
    output?: Record<string, unknown>;
    reason?: string;
    error?: string;
    stack?: string;
    pluginId?: string;
    label?: string;
    children?: InlineWorkflowTraceNode[];
}

export class InlineWorkflowTraceError extends Error {
    constructor(
        message: string,
        readonly trace: InlineWorkflowTraceNode[],
        options?: { cause?: unknown; }
    ) {
        super(message, options);
        this.name = 'InlineWorkflowTraceError';
    }
}

export interface InlineWorkflowExecutionResult {
    output: Record<string, unknown>;
    trace: InlineWorkflowTraceNode[];
}

export const cloneInlineWorkflowTraceNodes = (
    trace: InlineWorkflowTraceNode[],
    nextTraceId: () => string
): InlineWorkflowTraceNode[] => {
    return trace.map((node) => ({
        ...node,
        traceId: nextTraceId(),
        children: Array.isArray(node.children)
            ? cloneInlineWorkflowTraceNodes(node.children, nextTraceId)
            : undefined
    }));
};

const createTraceNode = (
    context: TraceRuntimeContext | null,
    input: Omit<InlineWorkflowTraceNode, 'traceId' | 'pluginId'>
): InlineWorkflowTraceNode | null => {
    if (!context) {
        return null;
    }

    return {
        traceId: context.nextTraceId(),
        pluginId: context.currentPluginId,
        ...input
    };
};

const appendTraceNode = (
    trace: InlineWorkflowTraceNode[],
    node: InlineWorkflowTraceNode | null
): void => {
    if (node) {
        trace.push(node);
    }
};

const createTraceContext = (
    currentPluginId: string,
    nextTraceId: (() => string) | undefined,
    enabled: boolean
): TraceRuntimeContext | null => {
    if (!enabled || !nextTraceId) {
        return null;
    }

    return {
        currentPluginId,
        nextTraceId
    };
};

const toError = (error: unknown, fallbackMessage: string): Error => {
    if (error instanceof Error) {
        return error;
    }

    return new Error(fallbackMessage);
};

export class InlineWorkflowRuntime {
    constructor(
        private readonly registry: WorkflowNodeRegistry,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService
    ) {}

    async executePluginNode(input: ExecuteInlinePluginNodeInput): Promise<InlineWorkflowExecutionResult> {
        let traceCounter = 0;
        const nextTraceId = (): string => `trace_${++traceCounter}`;

        return this.executeNestedPluginWorkflow(
            input,
            readWorkflowPluginNodeData(input.node.data.pluginNode),
            input.outputs,
            input.outputDir,
            createTraceContext(input.node.id, nextTraceId, input.captureTrace === true)
        );
    }

    async executePluginReference(input: ExecuteInlinePluginReferenceInput): Promise<InlineWorkflowExecutionResult> {
        let traceCounter = 0;
        const nextTraceId = (): string => `trace_${++traceCounter}`;

        return this.executeNestedPluginWorkflow(
            input,
            {
                pluginId: input.request.pluginId,
                config: input.request.config,
                selectedTimesteps: [input.dumpTarget.timestep]
            },
            input.outputs,
            input.outputDir,
            createTraceContext(input.request.pluginId, nextTraceId, input.captureTrace === true)
        );
    }

    private async executeNestedPluginWorkflow(
        input: InlineExecutionBaseInput,
        pluginNodeData: WorkflowPluginNodeData | undefined,
        parentOutputs: Map<string, Record<string, unknown>>,
        parentOutputDir: string,
        traceContext: TraceRuntimeContext | null
    ): Promise<NestedWorkflowExecutionResult> {
        const pluginId = typeof pluginNodeData?.pluginId === 'string' ? pluginNodeData.pluginId : '';
        if (!pluginId) {
            throw new Error('Inline plugin node is missing pluginId');
        }

        const nestedPlugin = input.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        const nestedOutputDir = `${parentOutputDir}_plugin_${pluginId}_${Date.now()}`;
        await fs.mkdir(nestedOutputDir, { recursive: true });
        const nestedOutputs = restoreWorkflowOutputs(snapshotWorkflowOutputs(parentOutputs));
        const selectedTimesteps = Array.isArray(pluginNodeData?.selectedTimesteps)
            ? pluginNodeData.selectedTimesteps.filter((value): value is number => typeof value === 'number')
            : [input.dumpTarget.timestep];
        const nestedContext = createWorkflowExecutionContext({
            outputs: nestedOutputs,
            userConfig: isRecord(pluginNodeData?.config) ? pluginNodeData.config : {},
            runtimeArguments: {},
            trajectoryId: input.trajectoryId,
            trajectoryFrames: [{
                timestep: input.dumpTarget.timestep,
                natoms: input.dumpTarget.natoms,
                simulationCell: input.dumpTarget.simulationCell
            }],
            trajectoryDumpOverrides: [{
                timestep: input.dumpTarget.timestep,
                natoms: input.dumpTarget.natoms,
                simulationCell: input.dumpTarget.simulationCell,
                path: input.dumpTarget.localPath,
                originalPath: input.dumpTarget.originalPath
            }],
            analysis: { _id: input.analysisId, pluginDisplayName: pluginId },
            analysisId: input.analysisId,
            pluginId,
            teamId: input.teamId,
            selectedTimestep: input.dumpTarget.timestep,
            selectedTimesteps,
            workflow: new WorkflowGraph(nestedPlugin.workflow),
            nestedPlugins: input.nestedPlugins
        });
        const workflowTraceContext = createTraceContext(
            pluginId,
            traceContext?.nextTraceId,
            traceContext !== null
        );
        const trace: InlineWorkflowTraceNode[] = [];
        const nestedPluginNodes = resolveInlinePluginExecutionOrder(nestedPlugin.workflow);
        const nestedEntrypointNode = nestedPlugin.workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        if (!nestedEntrypointNode) {
            throw new Error(`Nested plugin ${pluginId} has no entrypoint`);
        }

        for (const node of nestedContext.workflow.topologicalSort()) {
            if (node.id === nestedEntrypointNode.id) {
                break;
            }

            if (node.type === WorkflowNodeType.Plugin) {
                continue;
            }

            if (node.type === WorkflowNodeType.Exposure || node.type === WorkflowNodeType.Export) {
                continue;
            }

            const nodeStartedAt = Date.now();
            try {
                if (!this.registry.has(node.type)) {
                    appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'skipped',
                        durationMs: Date.now() - nodeStartedAt,
                        reason: `No handler registered for node type "${node.type}"`
                    }));
                    continue;
                }

                const output = await this.registry.execute(node, nestedContext);
                appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'completed',
                    durationMs: Date.now() - nodeStartedAt,
                    output
                }));

                if (node.type === WorkflowNodeType.ForEach) {
                    const forEachOutput = nestedOutputs.get(node.id) || {};
                    const items = Array.isArray(forEachOutput.items) ? forEachOutput.items : [];
                    if (!items.length) {
                        return {
                            output: createNestedExecutionResult([]),
                            trace
                        };
                    }

                    forEachOutput.currentValue = {
                        ...(isRecord(items[0]) ? items[0] : {}),
                        path: input.dumpTarget.localPath
                    };
                    forEachOutput.currentIndex = 0;
                    forEachOutput.outputPath = nestedOutputDir;
                    nestedOutputs.set(node.id, forEachOutput);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : `Nested node ${node.id} failed`;
                appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'error',
                    durationMs: Date.now() - nodeStartedAt,
                    error: message,
                    stack: error instanceof Error ? error.stack : undefined
                }));

                if (workflowTraceContext) {
                    throw new InlineWorkflowTraceError(message, trace, { cause: error });
                }

                throw toError(error, message);
            }
        }

        for (const pluginNode of nestedPluginNodes) {
            const pluginNodeStartedAt = Date.now();
            const childPluginNodeData = readWorkflowPluginNodeData(pluginNode.data.pluginNode);
            const childPluginId = typeof childPluginNodeData?.pluginId === 'string'
                ? childPluginNodeData.pluginId
                : pluginNode.id;

            try {
                const nestedOutput = await this.executeNestedPluginWorkflow(
                    {
                        ...input,
                        outputs: nestedOutputs
                    },
                    childPluginNodeData,
                    nestedOutputs,
                    nestedOutputDir,
                    createTraceContext(childPluginId, traceContext?.nextTraceId, traceContext !== null)
                );
                nestedOutputs.set(pluginNode.id, nestedOutput.output);
                appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                    nodeId: pluginNode.id,
                    nodeType: pluginNode.type,
                    status: 'completed',
                    durationMs: Date.now() - pluginNodeStartedAt,
                    output: nestedOutput.output,
                    children: nestedOutput.trace
                }));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : `Nested plugin node ${pluginNode.id} failed`;
                const children = error instanceof InlineWorkflowTraceError
                    ? error.trace
                    : undefined;
                appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                    nodeId: pluginNode.id,
                    nodeType: pluginNode.type,
                    status: 'error',
                    durationMs: Date.now() - pluginNodeStartedAt,
                    error: message,
                    stack: error instanceof Error ? error.stack : undefined,
                    children
                }));

                if (workflowTraceContext) {
                    throw new InlineWorkflowTraceError(message, trace, { cause: error });
                }

                throw toError(error, message);
            }
        }

        const entrypointStartedAt = Date.now();
        try {
            const entrypointOutput = await this.executeNestedEntrypoint(
                readWorkflowEntrypointData(nestedEntrypointNode.data.entrypoint),
                nestedOutputs,
                {
                    analysisId: input.analysisId,
                    pluginId
                },
                nestedOutputDir
            );
            appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                nodeId: nestedEntrypointNode.id,
                nodeType: nestedEntrypointNode.type,
                status: 'completed',
                durationMs: Date.now() - entrypointStartedAt,
                output: entrypointOutput
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : `Nested entrypoint ${nestedEntrypointNode.id} failed`;
            appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                nodeId: nestedEntrypointNode.id,
                nodeType: nestedEntrypointNode.type,
                status: 'error',
                durationMs: Date.now() - entrypointStartedAt,
                error: message,
                stack: error instanceof Error ? error.stack : undefined
            }));

            if (workflowTraceContext) {
                throw new InlineWorkflowTraceError(message, trace, { cause: error });
            }

            throw toError(error, message);
        }

        const exposures = await collectInlineExposureArtifacts(nestedPlugin.workflow, nestedOutputDir);
        const exposureArtifactsById = new Map(exposures.map((artifact) => [artifact.exposureId, artifact]));

        for (const node of nestedPlugin.workflow.nodes) {
            if (node.type === WorkflowNodeType.Exposure) {
                const exposureArtifact = exposureArtifactsById.get(node.id);
                appendTraceNode(trace, createTraceNode(workflowTraceContext, exposureArtifact
                    ? {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'completed',
                        durationMs: 0,
                        output: {
                            exposureId: exposureArtifact.exposureId,
                            name: exposureArtifact.name,
                            results: exposureArtifact.results,
                            filePath: exposureArtifact.filePath
                        }
                    }
                    : {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'skipped',
                        durationMs: 0,
                        reason: 'Exposure output was not generated by the nested plugin execution'
                    }
                ));
            }

            if (node.type === WorkflowNodeType.Export) {
                appendTraceNode(trace, createTraceNode(workflowTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'skipped',
                    durationMs: 0,
                    reason: 'Nested export nodes are not processed during inline plugin execution'
                }));
            }
        }

        return {
            output: createNestedExecutionResult(exposures),
            trace
        };
    }

    private async executeNestedEntrypoint(
        entrypointData: WorkflowEntrypointData | undefined,
        outputs: Map<string, Record<string, unknown>>,
        context: NestedEntrypointContext,
        outputDir: string
    ): Promise<Record<string, unknown>> {
        const binaryObjectPath = typeof entrypointData?.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath
            : '';
        const argumentsTemplate = typeof entrypointData?.arguments === 'string'
            ? entrypointData.arguments
            : '';
        const entrypointType = entrypointData?.type === EntrypointType.PythonScript
            ? EntrypointType.PythonScript
            : entrypointData?.type === EntrypointType.Executable
                ? EntrypointType.Executable
                : null;
        if (!binaryObjectPath || !argumentsTemplate) {
            throw new Error(`Nested plugin ${context.pluginId} has invalid entrypoint configuration`);
        }

        if (!entrypointType) {
            throw new Error(`Nested plugin ${context.pluginId} has invalid entrypoint type`);
        }

        const executionRuntime = await this.pluginBinaryCacheService.getExecutionRuntime({
            binaryObjectPath,
            entrypointType,
            requirementsFile: typeof entrypointData?.requirementsFile === 'string'
                ? entrypointData.requirementsFile
                : undefined,
            entrypointScript: typeof entrypointData?.entrypointScript === 'string' && entrypointData.entrypointScript.length > 0
                ? entrypointData.entrypointScript
                : undefined
        });
        const resolvedArgs = resolveWorkflowTemplate(argumentsTemplate, outputs);
        const args = parseInlineWorkflowArguments(resolvedArgs);
        const result = await this.binaryExecutorService.executeProcess({
            jobId: `${context.analysisId}:${context.pluginId}:inline`,
            commandPath: executionRuntime.commandPath,
            args: [...executionRuntime.argsPrefix, ...args],
            cwd: outputDir,
            env: executionRuntime.env,
            timeoutMs: entrypointData?.timeout
        });

        if (result.code !== 0) {
            throw new Error(`Nested plugin ${context.pluginId} failed with code ${result.code}: ${result.stderr || result.stdout}`);
        }

        return {
            binaryObjectPath,
            commandPath: executionRuntime.commandPath,
            artifactPath: executionRuntime.artifactPath,
            args: [...executionRuntime.argsPrefix, ...args],
            resolvedArguments: resolvedArgs,
            outputPath: outputDir,
            exitCode: result.code,
            stdout: result.stdout,
            stderr: result.stderr
        };
    }
}
