import { Service } from '@/core/decorators/service';
import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowNodeExecutor } from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';
import { WorkflowScheduler } from '@/modules/analysis/application/workflow/WorkflowScheduler';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowArgumentDefinition,
    WorkflowPluginReferenceSelection,
    DaemonAnalysisDocument,
    TrajectoryDumpDescriptor,
    NestedPluginDefinition,
    WorkflowPluginNodeData,
    TrajectoryFrame,
    WorkflowDefinition,
    WorkflowNodeDefinition
} from '@/contracts';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowOutputs
} from '@/modules/analysis/contracts/workflow.types';
import type { ProcessExecutionLogSink } from '@/core/runtime/contracts/execution-log';
import type { BinaryExecutorService } from '@/core/runtime/infrastructure/binary-executor-service';
import type { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import type { AnalysisJobExecutionData } from '@/modules/analysis/contracts/http-analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { ResultProcessorService } from '@/modules/plugin/application/exports/result-processor-service-contract';
import type { WorkflowExecutionOptions } from '@/modules/analysis/contracts/workflow.types';
import type { TrajectoryFrameStore } from '@/modules/trajectory/application/storage/TrajectoryFrameStore';
import type { AnalysisStageReporter } from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import ApplicationError from '@/app/coordination/ApplicationError';
import { dir as createTempDir } from 'tmp-promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getAvailableCpuCount, readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';
import { mapLimited } from '@/support/concurrency/map-limited';

interface WorkflowTraceContext {
    currentPluginId: string;
    traceCounter: WorkflowTraceCounter;
}

interface WorkflowTraceCounter {
    value: number;
}

interface WorkflowProcessLogContext {
    rootNodeId: string;
    nodeId: string;
    nodeType: string;
    pluginId: string;
    executionPath: string[];
    timesteps: number[];
}

export type WorkflowLogSinkFactory = (
    context: WorkflowProcessLogContext
) => ProcessExecutionLogSink | undefined;

interface WorkflowExecutionBaseInput {
    nestedPlugins: NestedPluginDefinition[];
    outputs: WorkflowOutputs;
    dumpTarget: WorkflowDumpTarget;
    outputDir: string;
    trajectoryId: string;
    trajectoryFrames?: AggregatedTrajectoryFrame[];
    analysisId: string;
    analysis: DaemonAnalysisDocument;
    teamId: string;
    ownerClusterId?: string;
    rootNodeId: string;
    executionPath: string[];
    logSinkFactory?: WorkflowLogSinkFactory;
    stageReporter?: AnalysisStageReporter;
}

type PluginNodeLike = Pick<WorkflowNodeDefinition, 'id' | 'type' | 'data'>;

export interface AggregatedTrajectoryFrame extends TrajectoryFrame {
    originalPath?: string;
}

export interface WorkflowExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

interface WorkflowExecutionResultExposures {
    items: WorkflowExposureArtifact[];
    str_json: string;
}

interface WorkflowExecutionResultData {
    exposures: WorkflowExecutionResultExposures;
}

export interface WorkflowExecutionResultOutput extends WorkflowNodeOutput {
    execution_result: WorkflowExecutionResultData;
}

export interface WorkflowDumpTarget {
    localPath: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface WorkflowPluginReferenceSelectionWithConfig {
    pluginId: WorkflowPluginReferenceSelection['pluginId'];
    config: WorkflowNodeOutput;
}

export interface WorkflowPluginReferenceValueWithSelections {
    selections: WorkflowPluginReferenceSelectionWithConfig[];
}

interface PluginExecutionOutput {
    pluginId: string;
    output: WorkflowNodeOutput;
}

export interface ExecutePluginNodeInput extends WorkflowExecutionBaseInput {
    node: PluginNodeLike;
    workflow?: WorkflowDefinition;
    captureTrace?: boolean;
}

interface NestedExecutionOutcome {
    output: WorkflowNodeOutput;
    trace: InlineWorkflowTraceNode[];
}

interface NestedNodeParams {
    workflow: WorkflowGraph;
    node: WorkflowNode;
    session: WorkflowSession;
    input: WorkflowExecutionBaseInput;
    outputDir: string;
    rootNodeId: string;
    executionPath: string[];
    trace: InlineWorkflowTraceNode[];
    traceContext: WorkflowTraceContext | null;
    logSinkFactory?: WorkflowLogSinkFactory;
    visitedNodeIds: Set<string>;
}

interface ResolvedPluginExecution {
    pluginId: string;
    config: WorkflowNodeOutput;
    selectedTimesteps: number[];
    outputPathMode: 'isolated' | 'parent';
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

interface WorkflowExecutionOutcome {
    output: WorkflowNodeOutput;
    trace: InlineWorkflowTraceNode[];
}

interface WorkflowTraceDetails {
    trace: InlineWorkflowTraceNode[];
}

export interface WorkflowExecuteInput {
    jobId: string;
    executionData: AnalysisJobExecutionData;
    outputs: WorkflowOutputs;
    dumpTargets: WorkflowDumpTarget[];
    outputDir: string;
    timestep: number;
    isBatchMode: boolean;
    artifactUploadBatch: ArtifactUploadBatch;
    logSinkFactory: WorkflowLogSinkFactory;
    stageReporter?: AnalysisStageReporter;
}

interface WorkflowVisitContext {
    input: WorkflowExecuteInput;
    session: WorkflowSession;
    graph: WorkflowGraph;
    scheduler: WorkflowScheduler;
    visitedNodeIds: Set<string>;
    node: WorkflowNode;
    executionPath: string[];
}

const WORKFLOW_TRACE_ERROR_CODE = 'Workflow::Trace';

const createWorkflowTraceFailure = (
    message: string,
    trace: InlineWorkflowTraceNode[],
    cause?: unknown
): ApplicationError => {
    return new ApplicationError(WORKFLOW_TRACE_ERROR_CODE, message, {
        statusCode: 500,
        details: { trace } satisfies WorkflowTraceDetails,
        cause
    });
};

const readWorkflowTrace = (error: unknown): InlineWorkflowTraceNode[] | undefined => {
    if (!(error instanceof ApplicationError) || error.code !== WORKFLOW_TRACE_ERROR_CODE) {
        return undefined;
    }

    const details = error.details as WorkflowTraceDetails | undefined;
    return Array.isArray(details?.trace) ? details.trace : undefined;
};

const MAX_BATCH_PLUGIN_CONCURRENCY = readPositiveIntegerEnv('PLUGIN_CONCURRENCY') ?? Math.max(1, getAvailableCpuCount() - 1);

@Service('workflowRuntime')
export class WorkflowRuntime {
    private readonly nodeExecutor: WorkflowNodeExecutor;

    constructor(
        workflowNodeRegistry: WorkflowNodeRegistry,
        private readonly pluginBinaryCache: PluginBinaryCache,
        private readonly binaryExecutorService: BinaryExecutorService,
        private readonly resultProcessor: ResultProcessorService,
        private readonly trajectoryFrameStore: TrajectoryFrameStore
    ) {
        this.nodeExecutor = new WorkflowNodeExecutor(workflowNodeRegistry);
    }

    async executePluginNode(input: ExecutePluginNodeInput): Promise<WorkflowExecutionOutcome> {
        const traceCounter = { value: 0 };
        const pluginNode = input.node.data.pluginNode;
        const executions = this.resolvePluginExecutionsForNode(
            input.workflow,
            pluginNode,
            input.outputs
        );
        if (!executions.length) {
            return {
                output: this.buildAggregatedPluginOutput([]),
                trace: []
            };
        }

        const executionPath = [...input.executionPath];
        const aggregatedExecutions: PluginExecutionOutput[] = [];
        const trace: InlineWorkflowTraceNode[] = [];

        for (const executionTarget of executions) {
            const startedAt = Date.now();
            const targetTraceContext = this.createTraceContext(
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
                this.appendTraceNode(trace, targetTraceContext, {
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
                const childTrace = readWorkflowTrace(runtimeError);
                this.appendTraceNode(trace, targetTraceContext, {
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
                    throw createWorkflowTraceFailure(message, trace, error);
                }

                throw this.toError(runtimeError, message);
            }
        }

        return {
            output: this.buildAggregatedPluginOutput(aggregatedExecutions),
            trace
        };
    }

    async execute(input: WorkflowExecuteInput): Promise<void> {
        const { executionData, outputs, dumpTargets } = input;
        const { identity, workflow, trajectoryFrames } = executionData;
        const session = WorkflowSession.createFromDefinition({
            outputs,
            userConfig: {},
            runtimeArguments: {},
            trajectoryId: identity.trajectoryId,
            trajectoryFrames,
            analysis: { _id: identity.analysisId, pluginDisplayName: identity.pluginId },
            analysisId: identity.analysisId,
            pluginId: identity.pluginId,
            teamId: identity.teamId,
            execution: this.buildRuntimeExecutionOptions(input),
            selectedTimestep: dumpTargets[0]!.timestep,
            workflow: workflow.definition,
            nestedPlugins: workflow.nestedPlugins
        });
        const graph = session.context.workflow;
        const visitedNodeIds = new Set<string>(outputs.keys());
        const scheduler = WorkflowScheduler.forVisitedNodes(graph, outputs, visitedNodeIds);

        for (const rootNode of graph.getRuntimeStartNodes()) {
            await this.visitRuntimeNode({
                input,
                session,
                graph,
                scheduler,
                visitedNodeIds,
                node: rootNode,
                executionPath: [rootNode.id]
            });
        }
    }

    private async visitRuntimeNode(ctx: WorkflowVisitContext): Promise<void> {
        if (ctx.visitedNodeIds.has(ctx.node.id)) {
            return;
        }
        ctx.visitedNodeIds.add(ctx.node.id);

        if (ctx.node.type === WorkflowNodeType.Export) {
            ctx.session.setOutput(ctx.node.id, {
                processed: false,
                skipped: true,
                reason: 'Export nodes are processed from their linked exposure'
            });
            return;
        }

        if (ctx.node.type === WorkflowNodeType.Plugin) {
            const output = await this.executePluginForRuntime(ctx);
            ctx.session.setOutput(ctx.node.id, output);
            await this.visitRuntimeChildren(ctx, output);
            return;
        }

        const stageKey = `${ctx.input.jobId}:entrypoint:${ctx.node.id}`;
        if (ctx.node.type === WorkflowNodeType.Entrypoint) {
            await ctx.input.stageReporter?.report({
                stageKey,
                label: 'Run plugin binary',
                stageType: 'entrypoint',
                stageStatus: 'running',
                pluginId: ctx.input.executionData.identity.pluginId,
                nodeId: ctx.node.id
            });
        }

        let execution: Awaited<ReturnType<WorkflowNodeExecutor['executeNode']>>;
        try {
            execution = await this.nodeExecutor.executeNode(ctx.node, this.buildRuntimeNodeContext(ctx));
        } catch (error) {
            if (ctx.node.type === WorkflowNodeType.Entrypoint) {
                await ctx.input.stageReporter?.report({
                    stageKey,
                    label: 'Run plugin binary',
                    stageType: 'entrypoint',
                    stageStatus: 'failed',
                    pluginId: ctx.input.executionData.identity.pluginId,
                    nodeId: ctx.node.id,
                    detail: error instanceof Error ? error.message : undefined
                });
            }
            throw error;
        }
        if (execution.status === 'skipped') {
            return;
        }

        const output = execution.output as WorkflowNodeOutput;
        if (ctx.node.type === WorkflowNodeType.Entrypoint) {
            await ctx.input.stageReporter?.report({
                stageKey,
                label: 'Run plugin binary',
                stageType: 'entrypoint',
                stageStatus: 'completed',
                pluginId: ctx.input.executionData.identity.pluginId,
                nodeId: ctx.node.id
            });
        }
        ctx.session.setOutput(ctx.node.id, output);
        await this.visitRuntimeChildren(ctx, output);
    }

    private async visitRuntimeChildren(ctx: WorkflowVisitContext, output?: WorkflowNodeOutput): Promise<void> {
        const childNodeIds = output
            ? ctx.scheduler.resolveChildNodeIds(ctx.node, output).activeNodeIds
            : ctx.graph.getChildNodeIds(ctx.node.id);

        for (const childNodeId of childNodeIds) {
            const childNode = ctx.graph.getNode(childNodeId);
            if (!childNode || !ctx.scheduler.isNodeReady(childNode.id)) {
                continue;
            }

            await this.visitRuntimeNode({
                ...ctx,
                node: childNode,
                executionPath: [...ctx.executionPath, childNode.id]
            });
        }
    }

    private async executePluginForRuntime(ctx: WorkflowVisitContext): Promise<WorkflowNodeOutput> {
        const { input } = ctx;
        if (input.dumpTargets.length === 0) {
            return this.createNestedExecutionResult([]);
        }

        const shouldBatch = input.isBatchMode && input.dumpTargets.length > 1;
        if (!shouldBatch) {
            const execution = await this.executePluginNode(
                this.buildPluginExecutionInput(ctx, input.dumpTargets[0]!, ctx.session.outputs, input.outputDir)
            );
            return execution.output;
        }

        const groups = await mapLimited(
            input.dumpTargets,
            Math.min(MAX_BATCH_PLUGIN_CONCURRENCY, input.dumpTargets.length),
            async (dumpTarget, index) => {
                const execution = await this.executePluginNode(
                    this.buildPluginExecutionInput(
                        ctx,
                        dumpTarget,
                        WorkflowSession.cloneOutputs(ctx.session.outputs),
                        `${input.outputDir}/batch-${index}`
                    )
                );
                return (execution.output as WorkflowExecutionResultOutput).execution_result.exposures.items;
            }
        );

        return this.createNestedExecutionResult(groups.flat());
    }

    private buildRuntimeExecutionOptions(input: WorkflowExecuteInput): WorkflowExecutionOptions {
        const {
            binaryObjectPath,
            ownerClusterId: pluginOwnerClusterId,
            arguments: argumentsTemplate,
            type,
            requirementsFile,
            entrypointScript
        } = input.executionData.entrypoint;
        const storageClusterId = input.executionData.identity.storageClusterId;

        return {
            entrypoint: {
                defaults: {
                    binaryObjectPath,
                    ownerClusterId: pluginOwnerClusterId,
                    argumentsTemplate,
                    entrypointType: type,
                    requirementsFile,
                    entrypointScript
                },
                jobId: input.jobId,
                outputDir: input.outputDir,
                pluginBinaryCache: this.pluginBinaryCache,
                binaryExecutorService: this.binaryExecutorService,
                trajectoryFrameStore: this.trajectoryFrameStore,
                ownerClusterId: storageClusterId,
                includeOutputFiles: true,
                nonZeroExitMessage: (result) => `Binary exited with code ${result.code}: ${result.stderr || result.stdout}`
            },
            exposure: {
                mode: 'runtime',
                outputDir: input.outputDir,
                executionData: input.executionData,
                timestep: input.timestep,
                artifactUploadBatch: input.artifactUploadBatch,
                resultProcessor: this.resultProcessor,
                stageReporter: input.stageReporter
            }
        };
    }

    private buildRuntimeNodeContext(ctx: WorkflowVisitContext): WorkflowExecutionContext {
        const baseContext = ctx.session.context;
        const entrypointExecution = baseContext.execution?.entrypoint;
        if (ctx.node.type !== WorkflowNodeType.Entrypoint || !entrypointExecution) {
            return baseContext;
        }

        return {
            ...baseContext,
            execution: {
                ...baseContext.execution,
                entrypoint: {
                    ...entrypointExecution,
                    logSink: ctx.input.logSinkFactory({
                        rootNodeId: ctx.node.id,
                        nodeId: ctx.node.id,
                        nodeType: ctx.node.type,
                        pluginId: ctx.input.executionData.identity.pluginId,
                        executionPath: ctx.executionPath,
                        timesteps: ctx.input.dumpTargets.map((target) => target.timestep)
                    })
                }
            }
        };
    }

    private buildPluginExecutionInput(
        ctx: WorkflowVisitContext,
        dumpTarget: WorkflowDumpTarget,
        outputs: WorkflowOutputs,
        outputDir: string
    ): ExecutePluginNodeInput {
        const { identity } = ctx.input.executionData;

        return {
            node: ctx.node,
            workflow: ctx.input.executionData.workflow.definition,
            nestedPlugins: ctx.input.executionData.workflow.nestedPlugins,
            outputs,
            dumpTarget,
            outputDir,
            trajectoryId: identity.trajectoryId,
            trajectoryFrames: ctx.input.executionData.trajectoryFrames,
            analysisId: identity.analysisId,
            analysis: { _id: identity.analysisId, pluginDisplayName: identity.pluginId },
            teamId: identity.teamId,
            ownerClusterId: identity.storageClusterId,
            rootNodeId: ctx.node.id,
            executionPath: ctx.executionPath,
            logSinkFactory: ctx.input.logSinkFactory,
            stageReporter: ctx.input.stageReporter
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

        let inferredMode: 'argumentReference' | 'manual' | undefined;
        if (!pluginNodeData.pluginId && pluginNodeData.argumentReference) {
            inferredMode = 'argumentReference';
        } else if (pluginNodeData.pluginId) {
            inferredMode = 'manual';
        }
        const executionMode = pluginNodeData.executionMode ?? inferredMode;
        const config = (pluginNodeData.config ?? {}) as WorkflowNodeOutput;
        const selectedTimesteps = pluginNodeData.selectedTimesteps ?? [];
        const outputPathMode = pluginNodeData.outputPathMode === 'parent' ? 'parent' : 'isolated';
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
            const selectionsValue = (
                argumentValue as WorkflowPluginReferenceValueWithSelections | undefined
            )?.selections;
            const selections = Array.isArray(selectionsValue) ? selectionsValue : [];
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
                selectedTimesteps,
                outputPathMode
            }));
        }

        const pluginId = pluginNodeData.pluginId;
        if (!pluginId) {
            return [];
        }

        return [{
            pluginId,
            config,
            selectedTimesteps,
            outputPathMode
        }];
    }

    private async executeNestedPluginWorkflow(
        input: WorkflowExecutionBaseInput,
        pluginNodeData: ResolvedPluginExecution,
        parentOutputs: WorkflowOutputs,
        parentOutputDir: string,
        traceContext: WorkflowTraceContext | null,
        rootNodeId: string,
        executionPath: string[],
        logSinkFactory: WorkflowLogSinkFactory | undefined
    ): Promise<NestedExecutionOutcome> {
        const { pluginId } = pluginNodeData;

        const nestedPlugin = input.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        const pluginDisplayName = this.resolveWorkflowDisplayName(nestedPlugin.workflow) ?? pluginId;
        const configHash = this.hashPluginRefConfig(pluginNodeData.config);
        const cacheKey = this.hashPluginRefConfig({
            trajectoryId: input.trajectoryId,
            timestep: input.dumpTarget.timestep,
            pluginId,
            configHash
        });
        const stageKey = `${input.analysisId}:${input.dumpTarget.timestep}:plugin-ref:${pluginId}:${configHash}`;
        const stageBase = {
            stageKey,
            label: pluginDisplayName,
            stageType: 'plugin-ref' as const,
            timestep: input.dumpTarget.timestep,
            pluginId,
            pluginDisplayName,
            configHash,
            nodeId: executionPath[executionPath.length - 1]
        };

        await fs.mkdir(parentOutputDir, { recursive: true });
        const nestedOutputDir = pluginNodeData.outputPathMode === 'parent'
            ? parentOutputDir
            : (await createTempDir({
                tmpdir: parentOutputDir,
                prefix: `inline-${pluginId}-`,
                unsafeCleanup: true
            })).path;
        const cacheDir = pluginNodeData.outputPathMode === 'parent'
            ? path.join(path.dirname(parentOutputDir), 'plugin-ref-cache', cacheKey)
            : undefined;

        await input.stageReporter?.report({
            ...stageBase,
            stageStatus: 'running'
        });

        if (cacheDir) {
            const cachedExposures = await this.restorePluginRefCache(cacheDir, parentOutputDir);
            if (cachedExposures) {
                await input.stageReporter?.report({
                    ...stageBase,
                    stageStatus: 'cached',
                    cacheHit: true,
                    detail: `${cachedExposures.length} cached artifact${cachedExposures.length === 1 ? '' : 's'} reused`
                });
                return {
                    output: this.createNestedExecutionResult(cachedExposures),
                    trace: []
                };
            }
        }

        const nestedOutputs = WorkflowSession.cloneOutputs(parentOutputs);
        const nestedSession = WorkflowSession.createFromDefinition({
            outputs: nestedOutputs,
            userConfig: pluginNodeData.config,
            runtimeArguments: {},
            trajectoryId: input.trajectoryId,
            trajectoryFrames: input.trajectoryFrames?.length
                ? input.trajectoryFrames
                : [{
                    timestep: input.dumpTarget.timestep,
                    natoms: input.dumpTarget.natoms,
                    simulationCell: input.dumpTarget.simulationCell
                }],
            trajectoryDumpOverrides: [this.createInlineDumpDescriptor(input.dumpTarget)],
            analysis: input.analysis,
            analysisId: input.analysisId,
            pluginId,
            teamId: input.teamId,
            selectedFrameOnly: true,
            selectedTimestep: input.dumpTarget.timestep,
            selectedTimesteps: pluginNodeData.selectedTimesteps,
            execution: {
                entrypoint: {
                    jobId: `${input.analysisId}:${pluginId}:inline`,
                    outputDir: nestedOutputDir,
                    pluginBinaryCache: this.pluginBinaryCache,
                    binaryExecutorService: this.binaryExecutorService,
                    trajectoryFrameStore: this.trajectoryFrameStore,
                    ownerClusterId: input.ownerClusterId,
                    nonZeroExitMessage: (result) => `Nested plugin ${pluginId} failed with code ${result.code}: ${result.stderr || result.stdout}`,
                    requireNonEmptyArguments: true,
                    requireEntrypointType: true,
                    errorMessage: `Nested plugin ${pluginId} has invalid entrypoint configuration`,
                    missingTypeMessage: `Nested plugin ${pluginId} has invalid entrypoint type`
                },
                exposure: {
                    mode: 'inline',
                    outputDir: nestedOutputDir
                }
            },
            workflow: nestedPlugin.workflow,
            nestedPlugins: input.nestedPlugins
        });
        const nestedContext = nestedSession.context;
        const workflowTraceContext = this.createTraceContext(
            pluginId,
            traceContext?.traceCounter,
            traceContext !== null
        );
        const localizedDumpTarget = WorkflowSession.createLocalDumpDescriptor(
            this.createInlineDumpDescriptor(input.dumpTarget),
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

        try {
            for (const node of nestedContext.workflow.topologicalSort()) {
                if (!planningNodeTypes.has(node.type)) {
                    continue;
                }

                const nodeStartedAt = Date.now();
                try {
                    const execution = await this.nodeExecutor.executeNode(node, nestedContext);
                    if (execution.status === 'skipped') {
                        this.appendTraceNode(trace, workflowTraceContext, {
                            nodeId: node.id,
                            nodeType: node.type,
                            status: 'skipped',
                            durationMs: Date.now() - nodeStartedAt,
                            reason: execution.reason
                        });
                        continue;
                    }

                    let output = execution.output as WorkflowNodeOutput;

                    if (node.type === WorkflowNodeType.Context) {
                        output = WorkflowSession.createLocalizedContextOutput(
                            output,
                            localizedDumpTarget,
                            nestedOutputDir
                        );
                        nestedSession.setOutput(node.id, output);
                    }

                    this.appendTraceNode(trace, workflowTraceContext, {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'completed',
                        durationMs: Date.now() - nodeStartedAt,
                        output
                    });

                    if (node.type === WorkflowNodeType.ForEach) {
                        const forEachOutput = nestedSession.getOutput(node.id);
                        if (!forEachOutput) {
                            await input.stageReporter?.report({
                                ...stageBase,
                                stageStatus: 'completed',
                                detail: 'No nested timesteps selected'
                            });
                            return {
                                output: this.createNestedExecutionResult([]),
                                trace
                            };
                        }
                        const items = forEachOutput.items as WorkflowNodeOutput[];
                        if (!items.length) {
                            await input.stageReporter?.report({
                                ...stageBase,
                                stageStatus: 'completed',
                                detail: 'No nested timesteps selected'
                            });
                            return {
                                output: this.createNestedExecutionResult([]),
                                trace
                            };
                        }

                        nestedSession.setForEachCurrentValue(
                            {
                                ...(items[0] as WorkflowNodeOutput),
                                path: input.dumpTarget.localPath
                            } as TrajectoryDumpDescriptor,
                            0,
                            nestedOutputDir
                        );
                    }
                } catch (error) {
                    const runtimeError = error instanceof Error ? error : undefined;
                    const message = runtimeError?.message ?? `Nested node ${node.id} failed`;
                    this.appendTraceNode(trace, workflowTraceContext, {
                        nodeId: node.id,
                        nodeType: node.type,
                        status: 'error',
                        durationMs: Date.now() - nodeStartedAt,
                        error: message,
                        stack: runtimeError?.stack
                    });

                    if (workflowTraceContext) {
                        throw createWorkflowTraceFailure(message, trace, error);
                    }

                    throw this.toError(runtimeError, message);
                }
            }

            const nestedRuntimeRootNodes = nestedContext.workflow.getRuntimeStartNodes();
            const visitedNodeIds = new Set<string>();

            for (const runtimeRootNode of nestedRuntimeRootNodes) {
                await this.executeNestedRuntimeNode({
                    workflow: nestedContext.workflow,
                    node: runtimeRootNode,
                    session: nestedSession,
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

            const exposures = this.collectNestedExposureArtifacts(nestedSession);
            if (cacheDir) {
                await this.persistPluginRefCache(cacheDir, nestedOutputDir, exposures);
            }
            await input.stageReporter?.report({
                ...stageBase,
                stageStatus: 'completed',
                detail: `${exposures.length} artifact${exposures.length === 1 ? '' : 's'} generated`
            });

            return {
                output: this.createNestedExecutionResult(exposures),
                trace
            };
        } catch (error) {
            await input.stageReporter?.report({
                ...stageBase,
                stageStatus: 'failed',
                detail: error instanceof Error ? error.message : undefined
            });
            throw error;
        }
    }

    private createNestedPluginExecutionInput(
        params: NestedNodeParams,
        executionPath: string[]
    ): ExecutePluginNodeInput {
        const { nestedPlugins, dumpTarget, trajectoryId, analysisId, teamId, ownerClusterId } = params.input;
        const { analysis, trajectoryFrames } = params.session.context;

        return {
            nestedPlugins,
            outputs: params.session.outputs,
            dumpTarget,
            outputDir: params.outputDir,
            trajectoryId,
            trajectoryFrames,
            analysisId,
            analysis,
            teamId,
            ownerClusterId,
            node: params.node,
            workflow: params.workflow.definition,
            captureTrace: params.traceContext !== null,
            rootNodeId: params.rootNodeId,
            executionPath,
            logSinkFactory: params.logSinkFactory,
            stageReporter: params.input.stageReporter
        };
    }

    private async restorePluginRefCache(
        cacheDir: string,
        targetOutputDir: string
    ): Promise<WorkflowExposureArtifact[] | null> {
        try {
            const manifestPath = path.join(cacheDir, 'manifest.json');
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
                files?: Array<{ cacheName: string; suffix: string }>;
                exposures?: Array<Omit<WorkflowExposureArtifact, 'filePath'> & { suffix: string }>;
            };
            if (!Array.isArray(manifest.files) || !Array.isArray(manifest.exposures)) {
                return null;
            }

            await fs.mkdir(path.dirname(targetOutputDir), { recursive: true });
            for (const file of manifest.files) {
                if (typeof file.cacheName !== 'string' || typeof file.suffix !== 'string') {
                    return null;
                }

                const source = path.join(cacheDir, file.cacheName);
                const target = `${targetOutputDir}${file.suffix}`;
                await fs.copyFile(source, target);
            }

            return manifest.exposures.map((exposure) => ({
                exposureId: exposure.exposureId,
                name: exposure.name,
                results: exposure.results,
                filePath: `${targetOutputDir}${exposure.suffix}`
            }));
        } catch {
            return null;
        }
    }

    private async persistPluginRefCache(
        cacheDir: string,
        sourceOutputDir: string,
        exposures: WorkflowExposureArtifact[]
    ): Promise<void> {
        const outputDirname = path.dirname(sourceOutputDir);
        const outputPrefix = `${path.basename(sourceOutputDir)}_`;
        const files = (await fs.readdir(outputDirname))
            .filter((filename) => filename.startsWith(outputPrefix))
            .map((filename) => {
                const suffix = filename.slice(path.basename(sourceOutputDir).length);
                return {
                    sourcePath: path.join(outputDirname, filename),
                    cacheName: filename.slice(outputPrefix.length),
                    suffix
                };
            });

        if (!files.length) {
            return;
        }

        await fs.rm(cacheDir, { recursive: true, force: true });
        await fs.mkdir(cacheDir, { recursive: true });

        await Promise.all(files.map((file) => fs.copyFile(
            file.sourcePath,
            path.join(cacheDir, file.cacheName)
        )));

        const manifest = {
            version: 1,
            createdAt: new Date().toISOString(),
            files: files.map(({ cacheName, suffix }) => ({ cacheName, suffix })),
            exposures: exposures
                .filter((exposure) => exposure.filePath.startsWith(sourceOutputDir))
                .map((exposure) => ({
                    exposureId: exposure.exposureId,
                    name: exposure.name,
                    results: exposure.results,
                    suffix: exposure.filePath.slice(sourceOutputDir.length)
                }))
        };

        await fs.writeFile(path.join(cacheDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    }

    private hashPluginRefConfig(value: unknown): string {
        return crypto
            .createHash('sha256')
            .update(this.stableStringify(value))
            .digest('hex')
            .slice(0, 24);
    }

    private stableStringify(value: unknown): string {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
        }

        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`
        ).join(',')}}`;
    }

    private resolveWorkflowDisplayName(workflow: WorkflowDefinition): string | null {
        const modifierNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
        const name = modifierNode?.data.modifier?.name;
        return typeof name === 'string' && name.trim().length > 0 ? name : null;
    }

    private collectNestedExposureArtifacts(session: WorkflowSession): WorkflowExposureArtifact[] {
        const artifacts: WorkflowExposureArtifact[] = [];

        for (const node of session.context.workflow.nodes) {
            if (node.type !== WorkflowNodeType.Exposure) {
                continue;
            }

            const output = session.getOutput(node.id);
            if (!output || output.skipped === true) {
                continue;
            }

            if (typeof output.filePath !== 'string' || typeof output.results !== 'string') {
                continue;
            }

            artifacts.push({
                exposureId: typeof output.exposureId === 'string' ? output.exposureId : node.id,
                name: typeof output.name === 'string' ? output.name : node.id,
                results: output.results,
                filePath: output.filePath
            });
        }

        return artifacts;
    }

    private createNestedNodeExecutionContext(
        params: NestedNodeParams,
        executionPath: string[]
    ): WorkflowExecutionContext {
        const baseContext = params.session.context;
        const entrypointExecution = baseContext.execution?.entrypoint;
        if (params.node.type !== WorkflowNodeType.Entrypoint || !entrypointExecution) {
            return baseContext;
        }

        return {
            ...baseContext,
            execution: {
                ...baseContext.execution,
                entrypoint: {
                    ...entrypointExecution,
                    logSink: params.logSinkFactory?.({
                        rootNodeId: params.rootNodeId,
                        nodeId: params.node.id,
                        nodeType: params.node.type,
                        pluginId: params.session.context.pluginId,
                        executionPath,
                        timesteps: [params.input.dumpTarget.timestep]
                    })
                }
            }
        };
    }

    private async executeNestedRuntimeNode(params: NestedNodeParams): Promise<void> {
        if (params.visitedNodeIds.has(params.node.id)) {
            return;
        }

        params.visitedNodeIds.add(params.node.id);

        if (params.node.type === WorkflowNodeType.Export) {
            return;
        }

        const nodeStartedAt = Date.now();
        const nodeExecutionPath = [...params.executionPath, params.node.id];

        try {
            if (params.node.type === WorkflowNodeType.Plugin) {
                const execution = await this.executePluginNode(
                    this.createNestedPluginExecutionInput(params, nodeExecutionPath)
                );
                params.session.setOutput(params.node.id, execution.output);
                this.appendTraceNode(params.trace, params.traceContext, {
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

            const execution = await this.nodeExecutor.executeNode(
                params.node,
                this.createNestedNodeExecutionContext(params, nodeExecutionPath)
            );
            if (execution.status === 'skipped') {
                this.appendTraceNode(params.trace, params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'skipped',
                    durationMs: Date.now() - nodeStartedAt,
                    reason: execution.reason
                });
                return;
            }

            const output = execution.output as WorkflowNodeOutput;
            if (output.skipped === true && typeof output.reason === 'string') {
                this.appendTraceNode(params.trace, params.traceContext, {
                    nodeId: params.node.id,
                    nodeType: params.node.type,
                    status: 'skipped',
                    durationMs: Date.now() - nodeStartedAt,
                    reason: output.reason
                });
                await this.executeNestedChildNodes(params, params.node, nodeExecutionPath);
                return;
            }

            this.appendTraceNode(params.trace, params.traceContext, {
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
            this.appendTraceNode(params.trace, params.traceContext, {
                nodeId: params.node.id,
                nodeType: params.node.type,
                status: 'error',
                durationMs: Date.now() - nodeStartedAt,
                error: message,
                stack: runtimeError?.stack
            });

            if (params.traceContext) {
                throw createWorkflowTraceFailure(message, params.trace, error);
            }

            throw this.toError(runtimeError, message);
        }
    }

    private async executeReadyNestedChild(
        params: NestedNodeParams,
        childNode: WorkflowNode,
        executionPath: string[]
    ): Promise<void> {
        const scheduler = WorkflowScheduler.forVisitedNodes(
            params.workflow,
            params.session.outputs,
            params.visitedNodeIds
        );
        if (!scheduler.isNodeReady(childNode.id)) {
            return;
        }

        await this.executeNestedRuntimeNode({
            ...params,
            node: childNode,
            executionPath
        });
    }

    private async executeNestedChildNodes(
        params: NestedNodeParams,
        node: WorkflowNode,
        executionPath: string[],
        output?: WorkflowNodeOutput
    ): Promise<void> {
        const scheduler = WorkflowScheduler.forVisitedNodes(
            params.workflow,
            params.session.outputs,
            params.visitedNodeIds
        );
        const childNodeIds = output
            ? scheduler.resolveChildNodeIds(node, output).activeNodeIds
            : params.workflow.getChildNodeIds(node.id);

        for (const childNodeId of childNodeIds) {
            const childNode = params.workflow.getNode(childNodeId);
            if (!childNode) {
                continue;
            }

            await this.executeReadyNestedChild(params, childNode, executionPath);
        }
    }

    private createTraceContext(
        currentPluginId: string,
        traceCounter: WorkflowTraceContext['traceCounter'] | undefined,
        enabled: boolean
    ): WorkflowTraceContext | null {
        if (!enabled || !traceCounter) {
            return null;
        }

        return {
            currentPluginId,
            traceCounter
        };
    }

    private toError(error: Error | undefined, fallbackMessage: string): Error {
        return error ?? new Error(fallbackMessage);
    }

    private buildAggregatedPluginOutput(executions: PluginExecutionOutput[]): WorkflowNodeOutput {
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
    }

    private createNestedExecutionResult(items: WorkflowExposureArtifact[]): WorkflowExecutionResultOutput {
        return {
            execution_result: {
                exposures: {
                    items,
                    str_json: JSON.stringify(items)
                }
            }
        };
    }

    private appendTraceNode(
        trace: InlineWorkflowTraceNode[],
        context: WorkflowTraceContext | null,
        input: Omit<InlineWorkflowTraceNode, 'traceId' | 'pluginId'>
    ): void {
        if (!context) {
            return;
        }

        trace.push({
            traceId: `trace_${++context.traceCounter.value}`,
            pluginId: context.currentPluginId,
            ...input
        });
    }

    private createInlineDumpDescriptor(dumpTarget: WorkflowDumpTarget): TrajectoryDumpDescriptor {
        return {
            timestep: dumpTarget.timestep,
            natoms: dumpTarget.natoms,
            simulationCell: dumpTarget.simulationCell,
            path: dumpTarget.localPath,
            originalPath: dumpTarget.originalPath
        };
    }

}
