import { createWorkflowExecutionContext, restoreWorkflowOutputs, snapshotWorkflowOutputs } from './WorkflowExecutionContextFactory';
import { resolveWorkflowTemplate } from './WorkflowOutputResolution';
import type { WorkflowNodeRegistry } from './NodeRegistry';
import {
    collectInlineExposureArtifacts,
    createNestedExecutionResult,
    parseInlineWorkflowArguments,
    readWorkflowEntrypointData,
    readWorkflowPluginNodeData,
    readWorkflowPluginReferenceSelections,
    type InlineWorkflowDumpTarget,
    type WorkflowEntrypointData,
    type WorkflowPluginNodeData,
    type WorkflowPluginReferenceSelection
} from './InlineWorkflowShared';
import { WorkflowGraph, WorkflowNodeType, type WorkflowNode } from '../contracts';
import {
    EntrypointType,
    type DaemonAnalysisDocument,
    type NestedPluginDefinition,
    type PluginReferenceExecutionRequest,
    type WorkflowDefinition,
    type WorkflowNodeDefinition
} from '@/shared/contracts';
import { isRecord } from '@/shared/utils';
import type {
    BinaryExecutorService,
    ProcessExecutionLogSink
} from '@/modules/job-runtime/services/BinaryExecutorService';
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

export interface InlineWorkflowProcessLogContext {
    rootNodeId: string;
    nodeId: string;
    nodeType: string;
    pluginId: string;
    executionPath: string[];
}

export type InlineWorkflowLogSinkFactory = (
    context: InlineWorkflowProcessLogContext
) => ProcessExecutionLogSink | undefined;

interface InlineExecutionBaseInput {
    nestedPlugins: NestedPluginDefinition[];
    outputs: Map<string, Record<string, unknown>>;
    dumpTarget: InlineWorkflowDumpTarget;
    outputDir: string;
    trajectoryId: string;
    trajectoryFrames?: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    analysisId: string;
    analysis?: DaemonAnalysisDocument;
    teamId: string;
    rootNodeId?: string;
    executionPath?: string[];
    logSinkFactory?: InlineWorkflowLogSinkFactory;
}

type InlinePluginNodeLike = Pick<WorkflowNodeDefinition, 'id' | 'type' | 'data'>;

export interface ExecuteInlinePluginNodeInput extends InlineExecutionBaseInput {
    node: InlinePluginNodeLike;
    workflow?: WorkflowDefinition;
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

interface ResolvedPluginExecution {
    pluginId: string;
    config: Record<string, unknown>;
    selectedTimesteps?: number[];
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

const createNestedContextOutput = (
    contextOutput: Record<string, unknown>,
    dumpTarget: InlineWorkflowDumpTarget,
    outputDir: string
): Record<string, unknown> => {
    const localDumpDescriptor = {
        timestep: dumpTarget.timestep,
        natoms: dumpTarget.natoms,
        simulationCell: dumpTarget.simulationCell,
        path: dumpTarget.localPath,
        originalPath: dumpTarget.originalPath
    };
    const trajectory = isRecord(contextOutput.trajectory)
        ? { ...contextOutput.trajectory }
        : {};

    trajectory.frames = [localDumpDescriptor];

    return {
        ...contextOutput,
        trajectory_dumps: [localDumpDescriptor],
        count: 1,
        trajectory,
        allDumpLocalPaths: JSON.stringify([dumpTarget.localPath]),
        outputPath: outputDir
    };
};

const getWorkflowChildren = (
    workflow: WorkflowGraph,
    nodeId: string,
    sourceHandle?: string
): WorkflowNode[] => {
    return workflow.edges
        .filter((edge) => edge.source === nodeId && (typeof sourceHandle === 'undefined' || edge.sourceHandle === sourceHandle))
        .map((edge) => workflow.nodes.find((candidate) => candidate.id === edge.target))
        .filter((candidate): candidate is WorkflowNode => Boolean(candidate));
};

const resolveRuntimeRootNodeIds = (workflow: WorkflowGraph): string[] => {
    const runtimeRootNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach)
        ?? workflow.nodes.find((node) => node.type === WorkflowNodeType.Context)
        ?? workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments)
        ?? workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier)
        ?? null;

    if (!runtimeRootNode) {
        return [];
    }

    return getWorkflowChildren(workflow, runtimeRootNode.id).map((node) => node.id);
};

const matchesIfBranchHandle = (
    edgeHandle: string | undefined,
    selectedBranch: string
): boolean => {
    if (selectedBranch === 'true') {
        return edgeHandle === 'output-true' || edgeHandle === 'true';
    }

    return edgeHandle === 'output-false' || edgeHandle === 'false';
};

const buildAggregatedPluginOutput = (
    executions: Array<{ pluginId: string; output: Record<string, unknown>; }>
): Record<string, unknown> => {
    const allExposureItems = executions.flatMap((execution) => {
        const executionResult = isRecord(execution.output.execution_result)
            ? execution.output.execution_result
            : undefined;
        const exposures = executionResult && isRecord(executionResult.exposures)
            ? executionResult.exposures
            : undefined;
        return Array.isArray(exposures?.items)
            ? exposures.items
            : [];
    });

    return {
        pluginIds: executions.map((execution) => execution.pluginId),
        executions: {
            items: executions,
            str_json: JSON.stringify(executions)
        },
        execution_result: {
            exposures: {
                items: allExposureItems,
                str_json: JSON.stringify(allExposureItems)
            }
        }
    };
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
        const pluginNodeData = readWorkflowPluginNodeData(input.node.data.pluginNode);
        const executions = this.resolvePluginExecutionsForNode(
            input.workflow,
            pluginNodeData,
            input.outputs
        );
        if (!executions.length) {
            return {
                output: buildAggregatedPluginOutput([]),
                trace: []
            };
        }

        const executionPath = Array.isArray(input.executionPath) && input.executionPath.length > 0
            ? [...input.executionPath]
            : [input.node.id];
        const aggregatedExecutions: Array<{ pluginId: string; output: Record<string, unknown>; }> = [];
        const trace: InlineWorkflowTraceNode[] = [];

        for (const executionTarget of executions) {
            const startedAt = Date.now();
            const targetTraceContext = createTraceContext(
                executionTarget.pluginId,
                nextTraceId,
                input.captureTrace === true
            );

            try {
                const nestedExecution = await this.executeNestedPluginWorkflow(
                    input,
                    executionTarget,
                    input.outputs,
                    input.outputDir,
                    targetTraceContext,
                    input.rootNodeId ?? input.node.id,
                    executionPath,
                    input.logSinkFactory
                );
                aggregatedExecutions.push({
                    pluginId: executionTarget.pluginId,
                    output: nestedExecution.output
                });
                appendTraceNode(trace, createTraceNode(targetTraceContext, {
                    nodeId: executionTarget.pluginId,
                    nodeType: input.node.type,
                    label: executionTarget.pluginId,
                    status: 'completed',
                    durationMs: Date.now() - startedAt,
                    output: nestedExecution.output,
                    children: nestedExecution.trace
                }));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : `Inline plugin ${executionTarget.pluginId} failed`;
                const childTrace = error instanceof InlineWorkflowTraceError
                    ? error.trace
                    : undefined;
                appendTraceNode(trace, createTraceNode(targetTraceContext, {
                    nodeId: executionTarget.pluginId,
                    nodeType: input.node.type,
                    label: executionTarget.pluginId,
                    status: 'error',
                    durationMs: Date.now() - startedAt,
                    error: message,
                    stack: error instanceof Error ? error.stack : undefined,
                    children: childTrace
                }));

                if (input.captureTrace === true) {
                    throw new InlineWorkflowTraceError(message, trace, { cause: error });
                }

                throw toError(error, message);
            }
        }

        return {
            output: buildAggregatedPluginOutput(aggregatedExecutions),
            trace
        };
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
            createTraceContext(input.request.pluginId, nextTraceId, input.captureTrace === true),
            input.rootNodeId ?? input.request.referencePath,
            Array.isArray(input.executionPath) && input.executionPath.length > 0
                ? [...input.executionPath]
                : [input.request.referencePath],
            input.logSinkFactory
        );
    }

    private resolvePluginExecutionsForNode(
        workflow: WorkflowDefinition | undefined,
        pluginNodeData: WorkflowPluginNodeData | undefined,
        outputs: Map<string, Record<string, unknown>>
    ): ResolvedPluginExecution[] {
        if (!pluginNodeData) {
            return [];
        }

        const selectedTimesteps = Array.isArray(pluginNodeData.selectedTimesteps)
            ? pluginNodeData.selectedTimesteps.filter((value): value is number => typeof value === 'number')
            : undefined;
        if (pluginNodeData.executionMode === 'argumentReference') {
            if (!workflow || !pluginNodeData.argumentReference) {
                return [];
            }

            const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
            if (!argumentsNode) {
                return [];
            }

            const argumentsOutput = outputs.get(argumentsNode.id) ?? {};
            const argumentValue = argumentsOutput[pluginNodeData.argumentReference];
            const selections = readWorkflowPluginReferenceSelections(argumentValue);
            if (!selections.length) {
                return [];
            }

            const argumentsData = isRecord(argumentsNode.data.arguments)
                ? argumentsNode.data.arguments
                : {};
            const argumentDefinitions = Array.isArray(argumentsData.arguments)
                ? argumentsData.arguments
                : [];
            const selectedArgumentDefinition = argumentDefinitions.find((definition: Record<string, unknown>) => {
                return definition?.argument === pluginNodeData.argumentReference;
            });
            const shouldUseSelectionConfig = selectedArgumentDefinition?.showPluginConfiguration === true;

            return selections.map((selection) => ({
                pluginId: selection.pluginId,
                config: shouldUseSelectionConfig
                    ? selection.config
                    : isRecord(pluginNodeData.configByPluginId?.[selection.pluginId])
                        ? pluginNodeData.configByPluginId?.[selection.pluginId] ?? {}
                        : isRecord(pluginNodeData.config)
                            ? pluginNodeData.config
                            : {},
                selectedTimesteps
            }));
        }

        const pluginId = typeof pluginNodeData.pluginId === 'string'
            ? pluginNodeData.pluginId.trim()
            : '';
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config: isRecord(pluginNodeData.config) ? pluginNodeData.config : {},
            selectedTimesteps
        }];
    }

    private async executeNestedPluginWorkflow(
        input: InlineExecutionBaseInput,
        pluginNodeData: WorkflowPluginNodeData | undefined,
        parentOutputs: Map<string, Record<string, unknown>>,
        parentOutputDir: string,
        traceContext: TraceRuntimeContext | null,
        rootNodeId: string,
        executionPath: string[],
        logSinkFactory: InlineWorkflowLogSinkFactory | undefined
    ): Promise<NestedWorkflowExecutionResult> {
        const pluginId = typeof pluginNodeData?.pluginId === 'string' ? pluginNodeData.pluginId : '';
        if (!pluginId) {
            throw new Error('Inline plugin node is missing pluginId');
        }

        const nestedPlugin = input.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        const nestedOutputDir = parentOutputDir;
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
            trajectoryFrames: Array.isArray(input.trajectoryFrames) && input.trajectoryFrames.length > 0
                ? input.trajectoryFrames
                : [{
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
            analysis: input.analysis ?? { _id: input.analysisId, pluginDisplayName: pluginId },
            analysisId: input.analysisId,
            pluginId,
            teamId: input.teamId,
            selectedFrameOnly: true,
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
        const planningNodeTypes = new Set<WorkflowNodeType>([
            WorkflowNodeType.Modifier,
            WorkflowNodeType.Arguments,
            WorkflowNodeType.Context,
            WorkflowNodeType.ForEach
        ]);

        for (const node of nestedContext.workflow.topologicalSort()) {
            if (!planningNodeTypes.has(node.type)) {
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

                let output = await this.registry.execute(node, nestedContext);

                if (node.type === WorkflowNodeType.Context) {
                    output = createNestedContextOutput(output, input.dumpTarget, nestedOutputDir);
                    nestedOutputs.set(node.id, output);
                }

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

        const runtimeRootNodeIds = resolveRuntimeRootNodeIds(nestedContext.workflow);
        const runtimeRootNodes = runtimeRootNodeIds.length > 0
            ? runtimeRootNodeIds
                .map((nodeId) => nestedContext.workflow.nodes.find((candidate) => candidate.id === nodeId))
                .filter((candidate): candidate is WorkflowNode => Boolean(candidate))
            : nestedContext.workflow.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
        const visitedNodeIds = new Set<string>();

        for (const runtimeRootNode of runtimeRootNodes) {
            await this.executeNestedRuntimeNode({
                workflow: nestedContext.workflow,
                node: runtimeRootNode,
                context: nestedContext,
                input,
                outputDir: nestedOutputDir,
                rootNodeId,
                executionPath,
                trace,
                traceContext: workflowTraceContext,
                logSinkFactory,
                visitedNodeIds
            });
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

    private async executeNestedRuntimeNode(params: {
        workflow: WorkflowGraph;
        node: WorkflowNode;
        context: ReturnType<typeof createWorkflowExecutionContext>;
        input: InlineExecutionBaseInput;
        outputDir: string;
        rootNodeId: string;
        executionPath: string[];
        trace: InlineWorkflowTraceNode[];
        traceContext: TraceRuntimeContext | null;
        logSinkFactory?: InlineWorkflowLogSinkFactory;
        visitedNodeIds: Set<string>;
    }): Promise<void> {
        if (params.visitedNodeIds.has(params.node.id)) {
            return;
        }

        params.visitedNodeIds.add(params.node.id);

        if (params.node.type === WorkflowNodeType.Exposure || params.node.type === WorkflowNodeType.Export) {
            return;
        }

        const nodeStartedAt = Date.now();
        const nodeExecutionPath = [...params.executionPath, params.node.id];

        try {
            if (params.node.type === WorkflowNodeType.Plugin) {
                const execution = await this.executePluginNode({
                    nestedPlugins: params.input.nestedPlugins,
                    outputs: params.context.outputs,
                    dumpTarget: params.input.dumpTarget,
                    outputDir: params.outputDir,
                    trajectoryId: params.input.trajectoryId,
                    trajectoryFrames: params.context.trajectoryFrames,
                    analysisId: params.input.analysisId,
                    analysis: params.context.analysis,
                    teamId: params.input.teamId,
                    node: params.node,
                    workflow: params.workflow.definition,
                    captureTrace: params.traceContext !== null,
                    rootNodeId: params.rootNodeId,
                    executionPath: nodeExecutionPath,
                    logSinkFactory: params.logSinkFactory
                });
                params.context.outputs.set(params.node.id, execution.output);
                appendTraceNode(params.trace, createTraceNode(params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'completed',
                    durationMs: Date.now() - nodeStartedAt,
                    output: execution.output,
                    children: execution.trace
                }));

                for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
                    await this.executeNestedRuntimeNode({
                        ...params,
                        node: childNode,
                        executionPath: nodeExecutionPath
                    });
                }
                return;
            }

            if (params.node.type === WorkflowNodeType.Entrypoint) {
                const entrypointOutput = await this.executeNestedEntrypoint(
                    readWorkflowEntrypointData(params.node.data.entrypoint),
                    params.context.outputs,
                    {
                        analysisId: params.input.analysisId,
                        pluginId: params.context.pluginId
                    },
                    params.outputDir,
                    params.rootNodeId,
                    params.node.id,
                    nodeExecutionPath,
                    params.workflow,
                    params.logSinkFactory
                );
                params.context.outputs.set(params.node.id, entrypointOutput);
                appendTraceNode(params.trace, createTraceNode(params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'completed',
                    durationMs: Date.now() - nodeStartedAt,
                    output: entrypointOutput
                }));

                for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
                    await this.executeNestedRuntimeNode({
                        ...params,
                        node: childNode,
                        executionPath: nodeExecutionPath
                    });
                }
                return;
            }

            if (!this.registry.has(params.node.type)) {
                appendTraceNode(params.trace, createTraceNode(params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'skipped',
                    durationMs: Date.now() - nodeStartedAt,
                    reason: `No handler registered for node type "${params.node.type}"`
                }));
                return;
            }

            const output = await this.registry.execute(params.node, params.context);
            appendTraceNode(params.trace, createTraceNode(params.traceContext, {
                nodeId: params.node.id,
                nodeType: params.node.type,
                status: 'completed',
                durationMs: Date.now() - nodeStartedAt,
                output
            }));

            if (params.node.type === WorkflowNodeType.IfStatement) {
                const branch = output.branch === 'false' ? 'false' : 'true';
                const childNodes = getWorkflowChildren(params.workflow, params.node.id)
                    .filter((childNode) => {
                        const edge = params.workflow.edges.find((candidate) => {
                            return candidate.source === params.node.id && candidate.target === childNode.id;
                        });
                        return matchesIfBranchHandle(edge?.sourceHandle, branch);
                    });

                for (const childNode of childNodes) {
                    await this.executeNestedRuntimeNode({
                        ...params,
                        node: childNode,
                        executionPath: nodeExecutionPath
                    });
                }
                return;
            }

            if (params.node.type === WorkflowNodeType.SwitchStatement) {
                const matchedCaseId = typeof output.matchedCaseId === 'string' && output.matchedCaseId.length > 0
                    ? output.matchedCaseId
                    : null;
                if (matchedCaseId) {
                    const matchedCaseNode = params.workflow.nodes.find((candidate) => candidate.id === matchedCaseId);
                    if (matchedCaseNode) {
                        await this.executeNestedRuntimeNode({
                            ...params,
                            node: matchedCaseNode,
                            executionPath: nodeExecutionPath
                        });
                    }
                }

                for (const childNode of getWorkflowChildren(params.workflow, params.node.id, 'continue')) {
                    await this.executeNestedRuntimeNode({
                        ...params,
                        node: childNode,
                        executionPath: nodeExecutionPath
                    });
                }
                return;
            }

            for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
                await this.executeNestedRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: nodeExecutionPath
                });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : `Nested runtime node ${params.node.id} failed`;
            appendTraceNode(params.trace, createTraceNode(params.traceContext, {
                nodeId: params.node.id,
                nodeType: params.node.type,
                status: 'error',
                durationMs: Date.now() - nodeStartedAt,
                error: message,
                stack: error instanceof Error ? error.stack : undefined
            }));

            if (params.traceContext) {
                throw new InlineWorkflowTraceError(message, params.trace, { cause: error });
            }

            throw toError(error, message);
        }
    }

    private async executeNestedEntrypoint(
        entrypointData: WorkflowEntrypointData | undefined,
        outputs: Map<string, Record<string, unknown>>,
        context: NestedEntrypointContext,
        outputDir: string,
        rootNodeId: string,
        nodeId: string,
        executionPath: string[],
        workflow: WorkflowGraph,
        logSinkFactory?: InlineWorkflowLogSinkFactory
    ): Promise<Record<string, unknown>> {
        const binaryObjectPath = typeof entrypointData?.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath
            : '';
        const argumentsTemplate = typeof entrypointData?.arguments === 'string'
            ? entrypointData.arguments
            : '';
        const entrypointType = entrypointData?.type === EntrypointType.PythonScript
            ? EntrypointType.PythonScript
            : entrypointData?.type === EntrypointType.PackagedExecutable
                ? EntrypointType.PackagedExecutable
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
        outputs.set(nodeId, {
            ...(outputs.get(nodeId) ?? {}),
            projectPath: executionRuntime.projectPath ?? ''
        });
        const resolvedArgs = resolveWorkflowTemplate(argumentsTemplate, outputs, {
            workflow,
            currentNodeId: nodeId
        });
        const args = parseInlineWorkflowArguments(resolvedArgs);
        const logSink = logSinkFactory?.({
            rootNodeId,
            nodeId,
            nodeType: WorkflowNodeType.Entrypoint,
            pluginId: context.pluginId,
            executionPath
        });
        const result = await this.binaryExecutorService.executeProcess({
            jobId: `${context.analysisId}:${context.pluginId}:inline`,
            commandPath: executionRuntime.commandPath,
            args: [...executionRuntime.argsPrefix, ...args],
            cwd: outputDir,
            env: executionRuntime.env,
            timeoutMs: entrypointData?.timeout,
            logSink
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
            projectPath: executionRuntime.projectPath ?? '',
            exitCode: result.code,
            stdout: result.stdout,
            stderr: result.stderr
        };
    }
}
