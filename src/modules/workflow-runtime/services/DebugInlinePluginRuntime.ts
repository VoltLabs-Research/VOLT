import { createWorkflowExecutionContext, restoreWorkflowOutputs, snapshotWorkflowOutputs } from './WorkflowExecutionContextFactory';
import { resolveWorkflowTemplate } from './WorkflowOutputResolution';
import type { WorkflowNodeRegistry } from './NodeRegistry';
import { WorkflowGraph, WorkflowNodeType, type WorkflowNode } from '../contracts';
import { EntrypointType, type NestedPluginDefinition, type PluginReferenceExecutionRequest, type TrajectoryFrame, type WorkflowDefinition } from '@/shared/contracts';
import { decodeCliArgumentsToken, isRecord } from '@/shared/utils';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import fs from 'node:fs/promises';

interface InlineExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

interface WorkflowExposureData {
    name?: string;
    results?: string;
}

interface WorkflowPluginNodeData {
    pluginId?: string;
    config?: Record<string, unknown>;
    selectedTimesteps?: number[];
}

interface WorkflowEntrypointData {
    arguments?: string;
    binaryObjectPath?: string;
    entrypointScript?: string;
    requirementsFile?: string;
    timeout?: number;
    type?: EntrypointType;
}

interface NestedEntrypointContext {
    analysisId: string;
    pluginId: string;
}

interface TraceRuntimeContext {
    currentPluginId: string;
    nextTraceId: () => string;
}

interface NestedWorkflowExecutionResult {
    output: Record<string, unknown>;
    trace: DebugTraceNode[];
}

export type DebugTraceNodeStatus = 'completed' | 'skipped' | 'error';

export interface DebugTraceNode {
    traceId: string;
    nodeId: string;
    nodeType: string;
    status: DebugTraceNodeStatus;
    durationMs: number;
    output?: Record<string, unknown>;
    reason?: string;
    error?: string;
    stack?: string;
    pluginId?: string;
    label?: string;
    children?: DebugTraceNode[];
}

export class DebugTraceError extends Error {
    constructor(
        message: string,
        readonly trace: DebugTraceNode[],
        options?: { cause?: unknown; }
    ) {
        super(message, options);
        this.name = 'DebugTraceError';
    }
}

export interface DebugDumpExecutionTarget {
    localPath: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

interface InlineExecutionBaseInput {
    workflow: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
    outputs: Map<string, Record<string, unknown>>;
    dumpTarget: DebugDumpExecutionTarget;
    outputDir: string;
    trajectoryId: string;
    analysisId: string;
    teamId: string;
    trajectoryFrames: TrajectoryFrame[];
}

interface ExecutePluginNodeInput extends InlineExecutionBaseInput {
    node: WorkflowNode;
}

interface ExecuteArgumentPluginReferencesInput extends InlineExecutionBaseInput {
    pluginReferenceExecutions: PluginReferenceExecutionRequest[];
}

export interface DebugInlineExecutionResult {
    output: Record<string, unknown>;
    trace: DebugTraceNode[];
}

export interface DebugInlineArgumentReferencesResult {
    output: Record<string, unknown> | null;
    trace: DebugTraceNode[];
}

const parseArguments = (value: string): string[] => {
    if (!value) {
        return [];
    }

    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const tokens = [...value.matchAll(regex)].map((match) => match[1] ?? match[2] ?? match[3]);

    return tokens.flatMap((token) => {
        const encodedArguments = decodeCliArgumentsToken(token);
        return encodedArguments ?? [token];
    });
};

const createNestedExecutionResult = (items: InlineExposureArtifact[]): Record<string, unknown> => ({
    execution_result: {
        exposures: {
            items,
            str_json: JSON.stringify(items)
        }
    }
});

const cloneTraceNodes = (
    trace: DebugTraceNode[],
    nextTraceId: () => string
): DebugTraceNode[] => {
    return trace.map((node) => ({
        ...node,
        traceId: nextTraceId(),
        children: Array.isArray(node.children)
            ? cloneTraceNodes(node.children, nextTraceId)
            : undefined
    }));
};

const readWorkflowExposureData = (value: unknown): WorkflowExposureData | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return {
        name: typeof value.name === 'string' ? value.name : undefined,
        results: typeof value.results === 'string' ? value.results : undefined
    };
};

const readWorkflowPluginNodeData = (value: unknown): WorkflowPluginNodeData | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return {
        pluginId: typeof value.pluginId === 'string' ? value.pluginId : undefined,
        config: isRecord(value.config) ? value.config : undefined,
        selectedTimesteps: Array.isArray(value.selectedTimesteps)
            ? value.selectedTimesteps.filter((entry): entry is number => typeof entry === 'number')
            : undefined
    };
};

const readWorkflowEntrypointData = (value: unknown): WorkflowEntrypointData | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return {
        binaryObjectPath: typeof value.binaryObjectPath === 'string' ? value.binaryObjectPath : undefined,
        arguments: typeof value.arguments === 'string' ? value.arguments : undefined,
        type: value.type === EntrypointType.Executable || value.type === EntrypointType.PythonScript
            ? value.type
            : undefined,
        requirementsFile: typeof value.requirementsFile === 'string' ? value.requirementsFile : undefined,
        entrypointScript: typeof value.entrypointScript === 'string' ? value.entrypointScript : undefined,
        timeout: typeof value.timeout === 'number' && Number.isFinite(value.timeout) ? value.timeout : undefined
    };
};

const setNestedValueAtPath = (target: Record<string, unknown>, pathExpression: string, value: unknown): void => {
    const segments = pathExpression
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);

    if (!segments.length) {
        return;
    }

    let cursor: unknown = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];
        const nextSegment = segments[index + 1];
        const nextIsIndex = /^\d+$/.test(nextSegment);

        if (Array.isArray(cursor)) {
            const arrayIndex = Number(segment);
            if (!Number.isInteger(arrayIndex)) {
                return;
            }

            const currentValue = cursor[arrayIndex];
            if (!Array.isArray(currentValue) && !isRecord(currentValue)) {
                const nextContainer = nextIsIndex ? [] : {};
                cursor[arrayIndex] = nextContainer;
                cursor = nextContainer;
                continue;
            }

            cursor = currentValue;
            continue;
        }

        if (!isRecord(cursor)) {
            return;
        }

        const currentValue = cursor[segment];
        if (!Array.isArray(currentValue) && !isRecord(currentValue)) {
            const nextContainer = nextIsIndex ? [] : {};
            cursor[segment] = nextContainer;
            cursor = nextContainer;
            continue;
        }

        cursor = currentValue;
    }

    const finalSegment = segments[segments.length - 1];
    if (Array.isArray(cursor)) {
        const arrayIndex = Number(finalSegment);
        if (Number.isInteger(arrayIndex)) {
            cursor[arrayIndex] = value;
        }
        return;
    }

    if (!isRecord(cursor)) {
        return;
    }

    cursor[finalSegment] = value;
};

const readNestedExposureItems = (output: Record<string, unknown>): InlineExposureArtifact[] => {
    const executionResult = isRecord(output.execution_result) ? output.execution_result : undefined;
    const exposures = executionResult && isRecord(executionResult.exposures)
        ? executionResult.exposures
        : undefined;
    const items = exposures?.items;

    return Array.isArray(items)
        ? items.filter((item): item is InlineExposureArtifact => isRecord(item)
            && typeof item.exposureId === 'string'
            && typeof item.name === 'string'
            && typeof item.results === 'string'
            && typeof item.filePath === 'string')
        : [];
};

const getSingleAdjacentNodeId = (
    adjacencyMap: Map<string, string[]>,
    nodeId: string,
    errorMessage: string
): string | undefined => {
    const adjacentNodeIds = adjacencyMap.get(nodeId) ?? [];
    if (adjacentNodeIds.length > 1) {
        throw new Error(errorMessage);
    }

    return adjacentNodeIds[0];
};

const resolveInlinePluginExecutionOrder = (
    workflow: WorkflowDefinition
): WorkflowDefinition['nodes'] => {
    const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
    const totalPluginNodes = workflow.nodes.filter((node) => node.type === WorkflowNodeType.Plugin).length;
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();

    for (const edge of workflow.edges) {
        const parents = parentMap.get(edge.target) ?? [];
        parents.push(edge.source);
        parentMap.set(edge.target, parents);

        const children = childMap.get(edge.source) ?? [];
        children.push(edge.target);
        childMap.set(edge.source, children);
    }

    const entrypointNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
    if (!entrypointNode) {
        throw new Error('Workflow entrypoint is missing');
    }

    let currentNodeId = getSingleAdjacentNodeId(
        parentMap,
        entrypointNode.id,
        `Top-level entrypoint ${entrypointNode.id} must have a single upstream chain`
    );
    const pluginNodes: WorkflowDefinition['nodes'] = [];

    while (currentNodeId) {
        const currentNode = nodeMap.get(currentNodeId);
        if (!currentNode) {
            throw new Error(`Workflow node ${currentNodeId} is missing from the inline plugin chain`);
        }

        if (currentNode.type === WorkflowNodeType.ForEach || currentNode.type === WorkflowNodeType.Context) {
            if (pluginNodes.length !== totalPluginNodes) {
                throw new Error('Unsupported inline plugin topology outside the entrypoint chain');
            }

            return pluginNodes.reverse();
        }

        if (currentNode.type !== WorkflowNodeType.Plugin) {
            throw new Error(`Unsupported inline plugin topology at node ${currentNode.id}`);
        }

        const pluginNodeData = readWorkflowPluginNodeData(currentNode.data.pluginNode);
        const pluginId = typeof pluginNodeData?.pluginId === 'string'
            ? pluginNodeData.pluginId.trim()
            : '';
        if (!pluginId) {
            throw new Error(`Plugin node ${currentNode.id} is missing pluginId`);
        }

        getSingleAdjacentNodeId(
            childMap,
            currentNode.id,
            `Plugin node ${currentNode.id} must have a single downstream chain`
        );
        pluginNodes.push(currentNode);
        currentNodeId = getSingleAdjacentNodeId(
            parentMap,
            currentNode.id,
            `Plugin node ${currentNode.id} must have a single upstream chain`
        );
    }

    if (pluginNodes.length !== totalPluginNodes) {
        throw new Error('Unsupported inline plugin topology outside the entrypoint chain');
    }

    throw new Error('Inline plugin chain must originate from the top-level forEach or context node');
};

const collectInlineExposureArtifacts = async (
    workflow: WorkflowDefinition,
    outputDir: string
): Promise<InlineExposureArtifact[]> => {
    const artifacts: InlineExposureArtifact[] = [];

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = readWorkflowExposureData(node.data.exposure);
        const results = exposureData?.results || '';
        if (!results) {
            continue;
        }

        const filePath = `${outputDir}_${results}`;
        try {
            await fs.access(filePath);
            artifacts.push({
                exposureId: node.id,
                name: exposureData?.name || node.id,
                results,
                filePath
            });
        } catch {
        }
    }

    return artifacts;
};

const createTraceNode = (
    context: TraceRuntimeContext,
    input: Omit<DebugTraceNode, 'traceId' | 'pluginId'>
): DebugTraceNode => ({
    traceId: context.nextTraceId(),
    pluginId: context.currentPluginId,
    ...input
});

const createTraceContext = (
    currentPluginId: string,
    nextTraceId: () => string
): TraceRuntimeContext => ({
    currentPluginId,
    nextTraceId
});

export class DebugInlinePluginRuntime {
    constructor(
        private readonly registry: WorkflowNodeRegistry,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService
    ) {}

    async executeArgumentPluginReferences(input: ExecuteArgumentPluginReferencesInput): Promise<DebugInlineArgumentReferencesResult> {
        let traceCounter = 0;
        const nextTraceId = (): string => `trace_${++traceCounter}`;
        const requests = Array.isArray(input.pluginReferenceExecutions)
            ? input.pluginReferenceExecutions.filter((request): request is PluginReferenceExecutionRequest => {
                return typeof request.referencePath === 'string'
                    && typeof request.pluginId === 'string'
                    && isRecord(request.config);
            })
            : [];

        if (!requests.length) {
            return {
                output: null,
                trace: []
            };
        }

        const dedupedRequests = new Map<string, PluginReferenceExecutionRequest>();
        for (const request of requests) {
            const dedupeKey = JSON.stringify({ pluginId: request.pluginId, config: request.config });
            if (!dedupedRequests.has(dedupeKey)) {
                dedupedRequests.set(dedupeKey, request);
            }
        }

        const dedupedResults = new Map<string, NestedWorkflowExecutionResult>();
        const trace: DebugTraceNode[] = [];

        for (const [dedupeKey, request] of dedupedRequests.entries()) {
            const startedAt = Date.now();
            try {
                const execution = await this.executeNestedPluginWorkflow(
                    input,
                    {
                        pluginId: request.pluginId,
                        config: request.config,
                        selectedTimesteps: [input.dumpTarget.timestep]
                    },
                    input.outputs,
                    `${input.outputDir}_plugin_reference`,
                    createTraceContext(request.pluginId, nextTraceId)
                );
                dedupedResults.set(dedupeKey, execution);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Plugin reference execution failed';
                const stack = error instanceof Error ? error.stack : undefined;
                const nestedTrace = error instanceof DebugTraceError ? error.trace : undefined;
                trace.push({
                    traceId: nextTraceId(),
                    nodeId: request.referencePath,
                    nodeType: 'plugin-reference',
                    label: 'Plugin Reference',
                    pluginId: request.pluginId,
                    status: 'error',
                    durationMs: Date.now() - startedAt,
                    error: message,
                    stack,
                    children: nestedTrace
                });
                throw new DebugTraceError(message, trace, { cause: error });
            }
        }

        for (const request of requests) {
            const dedupeKey = JSON.stringify({ pluginId: request.pluginId, config: request.config });
            const dedupedExecution = dedupedResults.get(dedupeKey);
            if (!dedupedExecution) {
                continue;
            }

            trace.push({
                traceId: nextTraceId(),
                nodeId: request.referencePath,
                nodeType: 'plugin-reference',
                label: 'Plugin Reference',
                pluginId: request.pluginId,
                status: 'completed',
                durationMs: 0,
                output: {
                    referencePath: request.referencePath,
                    pluginId: request.pluginId
                },
                children: cloneTraceNodes(dedupedExecution.trace, nextTraceId)
            });
        }

        const argumentsNode = input.workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
        if (!argumentsNode) {
            return {
                output: null,
                trace
            };
        }

        const argumentsOutput = { ...(input.outputs.get(argumentsNode.id) ?? {}) };
        const executionResultsObject: Record<string, unknown> = {};

        for (const request of requests) {
            const dedupeKey = JSON.stringify({ pluginId: request.pluginId, config: request.config });
            const dedupedResult = dedupedResults.get(dedupeKey);
            const executionResult = dedupedResult?.output.execution_result ?? createNestedExecutionResult([]).execution_result;

            executionResultsObject[request.referencePath] = executionResult;
            setNestedValueAtPath(argumentsOutput, request.referencePath, {
                pluginId: request.pluginId,
                config: request.config,
                execution_result: executionResult
            });
        }

        argumentsOutput.pluginReferences = {
            execution_results: executionResultsObject,
            execution_results_str_json: JSON.stringify(executionResultsObject)
        };

        input.outputs.set(argumentsNode.id, argumentsOutput);
        return {
            output: argumentsOutput,
            trace
        };
    }

    async executePluginNode(input: ExecutePluginNodeInput): Promise<DebugInlineExecutionResult> {
        let traceCounter = 0;
        const nextTraceId = (): string => `trace_${++traceCounter}`;
        return this.executeNestedPluginWorkflow(
            input,
            readWorkflowPluginNodeData(input.node.data.pluginNode),
            input.outputs,
            input.outputDir,
            createTraceContext(input.node.id, nextTraceId)
        );
    }

    private async executeNestedPluginWorkflow(
        input: InlineExecutionBaseInput,
        pluginNodeData: WorkflowPluginNodeData | undefined,
        parentOutputs: Map<string, Record<string, unknown>>,
        parentOutputDir: string,
        traceContext: TraceRuntimeContext
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
        const nestedTraceContext = createTraceContext(pluginId, traceContext.nextTraceId);
        const trace: DebugTraceNode[] = [];
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
                    trace.push(createTraceNode(nestedTraceContext, {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'skipped',
                        durationMs: Date.now() - nodeStartedAt,
                        reason: `No handler registered for node type "${node.type}"`
                    }));
                    continue;
                }

                const output = await this.registry.execute(node, nestedContext);
                trace.push(createTraceNode(nestedTraceContext, {
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
                trace.push(createTraceNode(nestedTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'error',
                    durationMs: Date.now() - nodeStartedAt,
                    error: message,
                    stack: error instanceof Error ? error.stack : undefined
                }));
                throw new DebugTraceError(message, trace, { cause: error });
            }
        }

        for (const pluginNode of nestedPluginNodes) {
            const pluginNodeStartedAt = Date.now();
            const childPluginNodeData = readWorkflowPluginNodeData(pluginNode.data.pluginNode);
            const childPluginId = typeof childPluginNodeData?.pluginId === 'string'
                ? childPluginNodeData.pluginId
                : undefined;

            try {
                const nestedOutput = await this.executeNestedPluginWorkflow(
                    {
                        ...input,
                        outputs: nestedOutputs,
                        workflow: nestedPlugin.workflow
                    },
                    childPluginNodeData,
                    nestedOutputs,
                    nestedOutputDir,
                    createTraceContext(childPluginId ?? pluginNode.id, traceContext.nextTraceId)
                );
                nestedOutputs.set(pluginNode.id, nestedOutput.output);
                trace.push(createTraceNode(nestedTraceContext, {
                    nodeId: pluginNode.id,
                    nodeType: pluginNode.type,
                    status: 'completed',
                    durationMs: Date.now() - pluginNodeStartedAt,
                    output: nestedOutput.output,
                    children: nestedOutput.trace
                }));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : `Nested plugin node ${pluginNode.id} failed`;
                const children = error instanceof DebugTraceError ? error.trace : undefined;
                trace.push(createTraceNode(nestedTraceContext, {
                    nodeId: pluginNode.id,
                    nodeType: pluginNode.type,
                    status: 'error',
                    durationMs: Date.now() - pluginNodeStartedAt,
                    error: message,
                    stack: error instanceof Error ? error.stack : undefined,
                    children
                }));
                throw new DebugTraceError(message, trace, { cause: error });
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
            trace.push(createTraceNode(nestedTraceContext, {
                nodeId: nestedEntrypointNode.id,
                nodeType: nestedEntrypointNode.type,
                status: 'completed',
                durationMs: Date.now() - entrypointStartedAt,
                output: entrypointOutput
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : `Nested entrypoint ${nestedEntrypointNode.id} failed`;
            trace.push(createTraceNode(nestedTraceContext, {
                nodeId: nestedEntrypointNode.id,
                nodeType: nestedEntrypointNode.type,
                status: 'error',
                durationMs: Date.now() - entrypointStartedAt,
                error: message,
                stack: error instanceof Error ? error.stack : undefined
            }));
            throw new DebugTraceError(message, trace, { cause: error });
        }

        const exposures = await collectInlineExposureArtifacts(nestedPlugin.workflow, nestedOutputDir);
        const exposureArtifactsById = new Map(exposures.map((artifact) => [artifact.exposureId, artifact]));

        for (const node of nestedPlugin.workflow.nodes) {
            if (node.type === WorkflowNodeType.Exposure) {
                const exposureArtifact = exposureArtifactsById.get(node.id);
                trace.push(createTraceNode(nestedTraceContext, exposureArtifact
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
                trace.push(createTraceNode(nestedTraceContext, {
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
        const args = parseArguments(resolvedArgs);
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
