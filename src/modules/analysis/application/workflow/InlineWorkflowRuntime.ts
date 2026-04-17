import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory';
import { collectInlineExposureArtifacts } from '@/modules/analysis/application/workflow/InlineWorkflowExposureArtifacts';
import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { createNestedExecutionResult, type InlineWorkflowDumpTarget, type WorkflowExecutionResultOutput, type WorkflowPluginReferenceValueWithSelections } from '@/modules/analysis/application/workflow/InlineWorkflowShared';
import { executeWorkflowEntrypoint } from '@/modules/analysis/application/workflow/WorkflowEntrypointExecution';
import { createLocalWorkflowDumpDescriptor, createLocalizedWorkflowContextOutput, setWorkflowForEachCurrentValue } from '@/modules/analysis/application/workflow/WorkflowTrajectoryState';
import { isWorkflowRuntimeNodeReady, resolveWorkflowRuntimeChildNodeIds } from '@/modules/analysis/application/workflow/WorkflowRuntimeScheduling';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowArgumentDefinition, DaemonAnalysisDocument, WorkflowEntrypointData, NestedPluginDefinition, WorkflowPluginNodeData, TrajectoryFrame, WorkflowDefinition, WorkflowNodeDefinition } from '@/contracts';
import type { WorkflowNode, WorkflowNodeOutput, WorkflowOutputs } from '@/modules/analysis/contracts/workflow.types';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

interface NestedEntrypointContext {
    analysisId: string;
    pluginId: string;
}

interface TraceRuntimeContext {
    currentPluginId: string;
    traceCounter: {
        value: number;
    };
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
    outputs: WorkflowOutputs;
    dumpTarget: InlineWorkflowDumpTarget;
    outputDir: string;
    trajectoryId: string;
    trajectoryFrames?: AggregatedTrajectoryFrame[];
    analysisId: string;
    analysis: DaemonAnalysisDocument;
    teamId: string;
    rootNodeId: string;
    executionPath: string[];
    logSinkFactory?: InlineWorkflowLogSinkFactory;
}

type InlinePluginNodeLike = Pick<WorkflowNodeDefinition, 'id' | 'type' | 'data'>;

export interface AggregatedTrajectoryFrame extends TrajectoryFrame {
    originalPath?: string;
};

interface PluginExecutionOutput {
    pluginId: string;
    output: WorkflowNodeOutput;
};

export interface ExecuteInlinePluginNodeInput extends InlineExecutionBaseInput {
    node: InlinePluginNodeLike;
    workflow?: WorkflowDefinition;
    captureTrace?: boolean;
}

interface NestedWorkflowExecutionResult {
    output: WorkflowNodeOutput;
    trace: InlineWorkflowTraceNode[];
}

interface ResolvedPluginExecution {
    pluginId: string;
    config: WorkflowNodeOutput;
    selectedTimesteps: number[];
}

type InlineWorkflowTraceStatus = 'completed' | 'skipped' | 'error';

export interface InlineWorkflowTraceNode {
    traceId: string;
    nodeId: string;
    nodeType: string;
    status: InlineWorkflowTraceStatus;
    durationMs: number;
    output?: WorkflowNodeOutput;
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
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = 'InlineWorkflowTraceError';
    }
}

interface InlineWorkflowExecutionResult {
    output: WorkflowNodeOutput;
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
        traceId: `trace_${++context.traceCounter.value}`,
        pluginId: context.currentPluginId,
        ...input
    };
};

const createTraceContext = (
    currentPluginId: string,
    traceCounter: TraceRuntimeContext['traceCounter'] | undefined,
    enabled: boolean
): TraceRuntimeContext | null => {
    if (!enabled || !traceCounter) {
        return null;
    }

    return {
        currentPluginId,
        traceCounter
    };
};

const toError = (error: Error | undefined, fallbackMessage: string): Error => error ?? new Error(fallbackMessage);

const buildAggregatedPluginOutput = (
    executions: PluginExecutionOutput[]
): WorkflowNodeOutput => {
    const allExposureItems = executions.flatMap(
        (execution) => (execution.output as WorkflowExecutionResultOutput).execution_result.exposures.items
    );

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

const appendTraceNode = (
    trace: InlineWorkflowTraceNode[],
    context: TraceRuntimeContext | null,
    input: Omit<InlineWorkflowTraceNode, 'traceId' | 'pluginId'>
): void => {
    const traceNode = createTraceNode(context, input);
    if (traceNode) {
        trace.push(traceNode);
    }
};

export class InlineWorkflowRuntime {
    private readonly registry: WorkflowNodeRegistry;

    constructor(
        workflowNodeRegistry: WorkflowNodeRegistry,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService
    ) {
        this.registry = workflowNodeRegistry;
    }

    async executePluginNode(input: ExecuteInlinePluginNodeInput): Promise<InlineWorkflowExecutionResult> {
        const traceCounter = { value: 0 };
        const pluginNode = input.node.data.pluginNode;
        const executions = this.resolvePluginExecutionsForNode(
            input.workflow,
            pluginNode,
            input.outputs
        );
        if (!executions.length) {
            return {
                output: buildAggregatedPluginOutput([]),
                trace: []
            };
        }

        const executionPath = [...input.executionPath];
        const aggregatedExecutions: PluginExecutionOutput[] = [];
        const trace: InlineWorkflowTraceNode[] = [];

        for (const executionTarget of executions) {
            const startedAt = Date.now();
            const targetTraceContext = createTraceContext(
                executionTarget.pluginId,
                traceCounter,
                input.captureTrace === true
            );

            try {
                const resolvedExecutionTarget = executionTarget.selectedTimesteps.length > 0
                    ? executionTarget
                    : {
                        ...executionTarget,
                        selectedTimesteps: [input.dumpTarget.timestep]
                    };
                const nestedExecution = await this.executeNestedPluginWorkflow(
                    input,
                    resolvedExecutionTarget,
                    input.outputs,
                    input.outputDir,
                    targetTraceContext,
                    input.rootNodeId,
                    executionPath,
                    input.logSinkFactory
                );
                aggregatedExecutions.push({
                    pluginId: executionTarget.pluginId,
                    output: nestedExecution.output
                });
                appendTraceNode(trace, targetTraceContext, {
                    nodeId: executionTarget.pluginId,
                    nodeType: input.node.type,
                    label: executionTarget.pluginId,
                    status: 'completed',
                    durationMs: Date.now() - startedAt,
                    output: nestedExecution.output,
                    children: nestedExecution.trace
                });
            } catch (error) {
                const runtimeError = error instanceof Error ? error : undefined;
                const message = runtimeError?.message ?? `Inline plugin ${executionTarget.pluginId} failed`;
                const childTrace = runtimeError instanceof InlineWorkflowTraceError
                    ? runtimeError.trace
                    : undefined;
                appendTraceNode(trace, targetTraceContext, {
                    nodeId: executionTarget.pluginId,
                    nodeType: input.node.type,
                    label: executionTarget.pluginId,
                    status: 'error',
                    durationMs: Date.now() - startedAt,
                    error: message,
                    stack: runtimeError?.stack,
                    children: childTrace
                });

                if (input.captureTrace === true) {
                    throw new InlineWorkflowTraceError(message, trace, { cause: error });
                }

                throw toError(runtimeError, message);
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
        outputs: WorkflowOutputs
    ): ResolvedPluginExecution[] {
        if (!pluginNodeData) {
            return [];
        }

        const executionMode = pluginNodeData.executionMode
            ?? (!pluginNodeData.pluginId && pluginNodeData.argumentReference ? 'argumentReference' : pluginNodeData.pluginId ? 'manual' : undefined);
        const config = (pluginNodeData.config ?? {}) as WorkflowNodeOutput;
        const selectedTimesteps = pluginNodeData.selectedTimesteps ?? [];
        if (executionMode === 'argumentReference') {
            if (!workflow || !pluginNodeData.argumentReference) {
                return [];
            }

            const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
            if (!argumentsNode) {
                return [];
            }

            const argumentsOutput = outputs.get(argumentsNode.id);
            if (!argumentsOutput) {
                return [];
            }
            const argumentValue = argumentsOutput[pluginNodeData.argumentReference];
            const selections = (argumentValue as WorkflowPluginReferenceValueWithSelections).selections;
            if (!selections.length) {
                return [];
            }

            const selectedArgumentDefinition = argumentsNode.data.arguments?.arguments?.find((definition: WorkflowArgumentDefinition) => {
                return definition.argument === pluginNodeData.argumentReference;
            });
            const shouldUseSelectionConfig = selectedArgumentDefinition?.showPluginConfiguration === true;

            return selections.map((selection) => ({
                pluginId: selection.pluginId,
                config: shouldUseSelectionConfig
                    ? selection.config
                    : (pluginNodeData.configByPluginId?.[selection.pluginId] as WorkflowNodeOutput | undefined) ?? config,
                selectedTimesteps
            }));
        }

        const pluginId = pluginNodeData.pluginId;
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config,
            selectedTimesteps
        }];
    }

    private async executeNestedPluginWorkflow(
        input: InlineExecutionBaseInput,
        pluginNodeData: ResolvedPluginExecution,
        parentOutputs: WorkflowOutputs,
        parentOutputDir: string,
        traceContext: TraceRuntimeContext | null,
        rootNodeId: string,
        executionPath: string[],
        logSinkFactory: InlineWorkflowLogSinkFactory | undefined
    ): Promise<NestedWorkflowExecutionResult> {
        const { pluginId } = pluginNodeData;

        const nestedPlugin = input.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        await fs.mkdir(parentOutputDir, { recursive: true });
        const nestedOutputDir = (await createTempDir({
            tmpdir: parentOutputDir,
            prefix: `inline-${pluginId}-`,
            unsafeCleanup: true
        })).path;
        const nestedOutputs = new Map(Object.entries(snapshotWorkflowOutputs(parentOutputs)));
        const trajectoryFrames = input.trajectoryFrames?.length
            ? input.trajectoryFrames
            : [{
                timestep: input.dumpTarget.timestep,
                natoms: input.dumpTarget.natoms,
                simulationCell: input.dumpTarget.simulationCell
            }];
        const nestedContext = createWorkflowExecutionContext({
            outputs: nestedOutputs,
            userConfig: pluginNodeData.config,
            runtimeArguments: {},
            trajectoryId: input.trajectoryId,
            trajectoryFrames,
            trajectoryDumpOverrides: [{
                timestep: input.dumpTarget.timestep,
                natoms: input.dumpTarget.natoms,
                simulationCell: input.dumpTarget.simulationCell,
                path: input.dumpTarget.localPath,
                originalPath: input.dumpTarget.originalPath
            }],
            analysis: input.analysis,
            analysisId: input.analysisId,
            pluginId,
            teamId: input.teamId,
            selectedFrameOnly: true,
            selectedTimestep: input.dumpTarget.timestep,
            selectedTimesteps: pluginNodeData.selectedTimesteps,
            workflow: new WorkflowGraph(nestedPlugin.workflow),
            nestedPlugins: input.nestedPlugins
        });
        const workflowTraceContext = createTraceContext(
            pluginId,
            traceContext?.traceCounter,
            traceContext !== null
        );
        const localizedDumpTarget = createLocalWorkflowDumpDescriptor(
            {
                timestep: input.dumpTarget.timestep,
                natoms: input.dumpTarget.natoms,
                simulationCell: input.dumpTarget.simulationCell,
                path: input.dumpTarget.localPath,
                originalPath: input.dumpTarget.originalPath
            },
            input.dumpTarget.localPath,
            {
                originalPath: input.dumpTarget.originalPath
            }
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
                    appendTraceNode(trace, workflowTraceContext, {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'skipped',
                        durationMs: Date.now() - nodeStartedAt,
                        reason: `No handler registered for node type "${node.type}"`
                    });
                    continue;
                }

                let output = await this.registry.execute(node, nestedContext) as WorkflowNodeOutput;
                nestedOutputs.set(node.id, output);

                if (node.type === WorkflowNodeType.Context) {
                    output = createLocalizedWorkflowContextOutput(
                        output,
                        localizedDumpTarget,
                        nestedOutputDir
                    );
                    nestedOutputs.set(node.id, output);
                }

                appendTraceNode(trace, workflowTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'completed',
                    durationMs: Date.now() - nodeStartedAt,
                    output
                });

                if (node.type === WorkflowNodeType.ForEach) {
                    const forEachOutput = nestedOutputs.get(node.id);
                    if (!forEachOutput) {
                        return {
                            output: createNestedExecutionResult([]),
                            trace
                        };
                    }
                    const items = forEachOutput.items as WorkflowNodeOutput[];
                    if (!items.length) {
                        return {
                            output: createNestedExecutionResult([]),
                            trace
                        };
                    }

                    setWorkflowForEachCurrentValue(
                        nestedContext,
                        {
                            ...(items[0] as WorkflowNodeOutput),
                            path: input.dumpTarget.localPath
                        },
                        0,
                        nestedOutputDir
                    );
                }
            } catch (error) {
                const runtimeError = error instanceof Error ? error : undefined;
                const message = runtimeError?.message ?? `Nested node ${node.id} failed`;
                appendTraceNode(trace, workflowTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'error',
                    durationMs: Date.now() - nodeStartedAt,
                    error: message,
                    stack: runtimeError?.stack
                });

                if (workflowTraceContext) {
                    throw new InlineWorkflowTraceError(message, trace, { cause: error });
                }

                throw toError(runtimeError, message);
            }
        }

        const runtimeRootNodes = nestedContext.workflow.getRuntimeRootNodes();
        const nestedRuntimeRootNodes = runtimeRootNodes.length > 0
            ? runtimeRootNodes
            : nestedContext.workflow.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
        const visitedNodeIds = new Set<string>();

        for (const runtimeRootNode of nestedRuntimeRootNodes) {
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
                appendTraceNode(trace, workflowTraceContext, exposureArtifact
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
                );
            }

            if (node.type === WorkflowNodeType.Export) {
                appendTraceNode(trace, workflowTraceContext, {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'skipped',
                    durationMs: 0,
                    reason: 'Nested export nodes are not processed during inline plugin execution'
                });
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
                appendTraceNode(params.trace, params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'completed',
                    durationMs: Date.now() - nodeStartedAt,
                    output: execution.output,
                    children: execution.trace
                });
                await this.executeNestedChildNodes(params, params.node, nodeExecutionPath);
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
                appendTraceNode(params.trace, params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'completed',
                    durationMs: Date.now() - nodeStartedAt,
                    output: entrypointOutput
                });
                await this.executeNestedChildNodes(params, params.node, nodeExecutionPath);
                return;
            }

            if (!this.registry.has(params.node.type)) {
                appendTraceNode(params.trace, params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'skipped',
                    durationMs: Date.now() - nodeStartedAt,
                    reason: `No handler registered for node type "${params.node.type}"`
                });
                return;
            }

            const output = await this.registry.execute(params.node, params.context) as WorkflowNodeOutput;
            params.context.outputs.set(params.node.id, output);
            appendTraceNode(params.trace, params.traceContext, {
                nodeId: params.node.id,
                nodeType: params.node.type,
                status: 'completed',
                durationMs: Date.now() - nodeStartedAt,
                output
            });
            await this.executeNestedChildNodes(params, params.node, nodeExecutionPath, output);
        } catch (error) {
            const runtimeError = error instanceof Error ? error : undefined;
            const message = runtimeError?.message ?? `Nested runtime node ${params.node.id} failed`;
            appendTraceNode(params.trace, params.traceContext, {
                nodeId: params.node.id,
                nodeType: params.node.type,
                status: 'error',
                durationMs: Date.now() - nodeStartedAt,
                error: message,
                stack: runtimeError?.stack
            });

            if (params.traceContext) {
                throw new InlineWorkflowTraceError(message, params.trace, { cause: error });
            }

            throw toError(runtimeError, message);
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

    private async executeNestedChildNodes(
        params: Parameters<InlineWorkflowRuntime['executeNestedRuntimeNode']>[0],
        node: WorkflowNode,
        executionPath: string[],
        output?: WorkflowNodeOutput
    ): Promise<void> {
        const childNodeIds = output && (node.type === WorkflowNodeType.IfStatement || node.type === WorkflowNodeType.SwitchStatement)
            ? resolveWorkflowRuntimeChildNodeIds(params.workflow, node, output).activeNodeIds
            : params.workflow.getChildren(node.id).map((childNode) => childNode.id);

        for (const childNodeId of childNodeIds) {
            const childNode = params.workflow.getNode(childNodeId);
            if (!childNode) {
                continue;
            }

            await this.executeReadyNestedChild(params, childNode, executionPath);
        }
    }

    private executeNestedEntrypoint(
        entrypointData: WorkflowEntrypointData | undefined,
        outputs: WorkflowOutputs,
        context: NestedEntrypointContext,
        outputDir: string,
        rootNodeId: string,
        nodeId: string,
        executionPath: string[],
        workflow: WorkflowGraph,
        logSinkFactory?: InlineWorkflowLogSinkFactory
    ): Promise<WorkflowNodeOutput> {
        if (!entrypointData?.binaryObjectPath || !entrypointData.arguments) {
            throw new Error(`Nested plugin ${context.pluginId} has invalid entrypoint configuration`);
        }

        if (!entrypointData.type) {
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
                binaryObjectPath: entrypointData.binaryObjectPath,
                argumentsTemplate: entrypointData.arguments,
                entrypointType: entrypointData.type,
                requirementsFile: entrypointData.requirementsFile,
                entrypointScript: entrypointData.entrypointScript,
                timeoutMs: entrypointData.timeout
            },
            jobId: `${context.analysisId}:${context.pluginId}:inline`,
            outputDir,
            pluginBinaryCacheService: this.pluginBinaryCacheService,
            binaryExecutorService: this.binaryExecutorService,
            logSink,
            nonZeroExitMessage: (result) => `Nested plugin ${context.pluginId} failed with code ${result.code}: ${result.stderr || result.stdout}`
        }) as Promise<WorkflowNodeOutput>;
    }
}
