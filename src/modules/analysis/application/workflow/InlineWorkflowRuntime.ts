import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory';
import { collectInlineExposureArtifacts } from '@/modules/analysis/application/workflow/InlineWorkflowExposureArtifacts';
import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { createNestedExecutionResult, readNestedExposureItems, readWorkflowPluginReferenceSelections, type InlineWorkflowDumpTarget } from '@/modules/analysis/application/workflow/InlineWorkflowShared';
import { executeWorkflowEntrypoint } from '@/modules/analysis/application/workflow/WorkflowEntrypointExecution';
import { isWorkflowRuntimeNodeReady, resolveWorkflowRuntimeChildNodeIds } from '@/modules/analysis/application/workflow/WorkflowRuntimeScheduling';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowArgumentDefinition, DaemonAnalysisDocument, WorkflowEntrypointData, NestedPluginDefinition, WorkflowPluginNodeData, TrajectoryFrame, WorkflowDefinition, WorkflowNodeDefinition } from '@/contracts';
import type { WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import fs from 'node:fs/promises';
import path from 'node:path';

interface NestedEntrypointContext {
    analysisId: string;
    pluginId: string;
}

interface TraceRuntimeContext {
    currentPluginId: string;
    nextTraceId: () => string;
}

interface InlineWorkflowProcessLogContext {
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
    trajectoryFrames?: AggregatedTrajectoryFrame[];
    analysisId: string;
    analysis?: DaemonAnalysisDocument;
    teamId: string;
    rootNodeId?: string;
    executionPath?: string[];
    logSinkFactory?: InlineWorkflowLogSinkFactory;
}

type InlinePluginNodeLike = Pick<WorkflowNodeDefinition, 'id' | 'type' | 'data'>;

export interface AggregatedTrajectoryFrame extends TrajectoryFrame {
    originalPath?: string;
};

interface PluginExecutionOutput {
    pluginId: string;
    output: Record<string, unknown>;
};

export interface ExecuteInlinePluginNodeInput extends InlineExecutionBaseInput {
    node: InlinePluginNodeLike;
    workflow?: WorkflowDefinition;
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

type InlineWorkflowTraceStatus = 'completed' | 'skipped' | 'error';

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

interface InlineWorkflowExecutionResult {
    output: Record<string, unknown>;
    trace: InlineWorkflowTraceNode[];
}

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
    const trajectory = {
        ...(contextOutput.trajectory as Record<string, unknown> | undefined)
    };

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

const buildAggregatedPluginOutput = (
    executions: PluginExecutionOutput[]
): Record<string, unknown> => {
    const allExposureItems = executions.flatMap((execution) => readNestedExposureItems(execution.output));

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
        const pluginNode = input.node.data.pluginNode;
        const pluginId = pluginNode?.pluginId?.trim() || undefined;
        const argumentReference = pluginNode?.argumentReference?.trim() || undefined;
        const pluginNodeData = pluginNode && {
            ...pluginNode,
            executionMode: pluginNode.executionMode
                ?? (!pluginId && argumentReference ? 'argumentReference' : pluginId ? 'manual' : undefined),
            pluginId,
            argumentReference
        };
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
        const aggregatedExecutions: PluginExecutionOutput[] = [];
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

    private resolvePluginExecutionsForNode(
        workflow: WorkflowDefinition | undefined,
        pluginNodeData: WorkflowPluginNodeData | undefined,
        outputs: Map<string, Record<string, unknown>>
    ): ResolvedPluginExecution[] {
        if (!pluginNodeData) {
            return [];
        }

        const selectedTimesteps = pluginNodeData.selectedTimesteps;
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

            const selectedArgumentDefinition = argumentsNode.data.arguments?.arguments?.find((definition: WorkflowArgumentDefinition) => {
                return definition?.argument === pluginNodeData.argumentReference;
            });
            const shouldUseSelectionConfig = selectedArgumentDefinition?.showPluginConfiguration === true;

            return selections.map((selection) => ({
                pluginId: selection.pluginId,
                config: shouldUseSelectionConfig
                    ? selection.config ?? {}
                    : pluginNodeData.configByPluginId?.[selection.pluginId] ?? pluginNodeData.config ?? {},
                selectedTimesteps
            }));
        }

        const pluginId = pluginNodeData.pluginId;
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config: pluginNodeData.config ?? {},
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
        const pluginId = pluginNodeData?.pluginId;
        if (!pluginId) {
            throw new Error('Inline plugin node is missing pluginId');
        }

        const nestedPlugin = input.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        const nestedOutputDir = path.join(
            parentOutputDir,
            `inline-${pluginId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        );
        await fs.mkdir(nestedOutputDir, { recursive: true });
        const nestedOutputs = new Map(Object.entries(snapshotWorkflowOutputs(parentOutputs)));
        const selectedTimesteps = pluginNodeData?.selectedTimesteps ?? [input.dumpTarget.timestep];
        const nestedContext = createWorkflowExecutionContext({
            outputs: nestedOutputs,
            userConfig: pluginNodeData?.config ?? {},
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
                nestedOutputs.set(node.id, output);

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
                        ...(items[0] as Record<string, unknown>),
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

        const runtimeRootNodeIds = nestedContext.workflow.getRuntimeRootNodeIds();
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

                for (const childNode of params.workflow.getChildren(params.node.id)) {
                    await this.executeReadyNestedChild(params, childNode, nodeExecutionPath);
                }
                return;
            }

            if (params.node.type === WorkflowNodeType.Entrypoint) {
                const entrypointOutput = await this.executeNestedEntrypoint(
                    params.node.data.entrypoint,
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

                for (const childNode of params.workflow.getChildren(params.node.id)) {
                    await this.executeReadyNestedChild(params, childNode, nodeExecutionPath);
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
            params.context.outputs.set(params.node.id, output);
            appendTraceNode(params.trace, createTraceNode(params.traceContext, {
                nodeId: params.node.id,
                nodeType: params.node.type,
                status: 'completed',
                durationMs: Date.now() - nodeStartedAt,
                output
            }));

            if (params.node.type === WorkflowNodeType.IfStatement) {
                const childNodes = resolveWorkflowRuntimeChildNodeIds(params.workflow, params.node, output).activeNodeIds
                    .map((childNodeId) => params.workflow.nodes.find((candidate) => candidate.id === childNodeId))
                    .filter((childNode): childNode is WorkflowNode => Boolean(childNode));

                for (const childNode of childNodes) {
                    await this.executeReadyNestedChild(params, childNode, nodeExecutionPath);
                }
                return;
            }

            if (params.node.type === WorkflowNodeType.SwitchStatement) {
                const childNodes = resolveWorkflowRuntimeChildNodeIds(params.workflow, params.node, output).activeNodeIds
                    .map((childNodeId) => params.workflow.nodes.find((candidate) => candidate.id === childNodeId))
                    .filter((childNode): childNode is WorkflowNode => Boolean(childNode));

                for (const childNode of childNodes) {
                    await this.executeReadyNestedChild(params, childNode, nodeExecutionPath);
                }
                return;
            }

            for (const childNode of params.workflow.getChildren(params.node.id)) {
                await this.executeReadyNestedChild(params, childNode, nodeExecutionPath);
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

    private async executeReadyNestedChild(
        params: Parameters<InlineWorkflowRuntime['executeNestedRuntimeNode']>[0],
        childNode: WorkflowNode,
        executionPath: string[]
    ): Promise<void> {
        if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.context.outputs, params.visitedNodeIds)) {
            return;
        }

        await this.executeNestedRuntimeNode({
            ...params,
            node: childNode,
            executionPath
        });
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
        const binaryObjectPath = entrypointData?.binaryObjectPath ?? '';
        const argumentsTemplate = entrypointData?.arguments ?? '';
        const entrypointType = entrypointData?.type;
        if (!binaryObjectPath || !argumentsTemplate) {
            throw new Error(`Nested plugin ${context.pluginId} has invalid entrypoint configuration`);
        }

        if (!entrypointType) {
            throw new Error(`Nested plugin ${context.pluginId} has invalid entrypoint type`);
        }

        const logSink = logSinkFactory?.({
            rootNodeId,
            nodeId,
            nodeType: WorkflowNodeType.Entrypoint,
            pluginId: context.pluginId,
            executionPath
        });

        return executeWorkflowEntrypoint({
            outputs,
            workflow,
            nodeId,
            entrypoint: {
                binaryObjectPath,
                argumentsTemplate,
                entrypointType,
                requirementsFile: entrypointData?.requirementsFile,
                entrypointScript: entrypointData?.entrypointScript || undefined,
                timeoutMs: entrypointData?.timeout
            },
            jobId: `${context.analysisId}:${context.pluginId}:inline`,
            outputDir,
            pluginBinaryCacheService: this.pluginBinaryCacheService,
            binaryExecutorService: this.binaryExecutorService,
            logSink,
            nonZeroExitMessage: (result) => `Nested plugin ${context.pluginId} failed with code ${result.code}: ${result.stderr || result.stdout}`
        });
    }
}
