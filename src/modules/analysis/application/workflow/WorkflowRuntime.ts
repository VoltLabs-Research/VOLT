import { Service } from '@/core/decorators/service';
import { isPlanningNodeType, type WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowNodeExecutor } from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';
import { WorkflowPlanner } from '@/modules/analysis/application/workflow/WorkflowPlanner';
import { WorkflowScheduler } from '@/modules/analysis/application/workflow/WorkflowScheduler';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
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
import {
    WorkflowWalker,
    createWorkflowTraceFailure,
    readWorkflowTrace,
    type InlineWorkflowTraceNode,
    type WorkflowTraceCounter,
    type WorkflowWalkerDelegate
} from '@/modules/analysis/application/workflow/WorkflowWalker';
import { dir as createTempDir } from 'tmp-promise';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Re-exported so existing consumers (e.g. DebugSessionManager) keep importing
// the trace node type from WorkflowRuntime; the canonical definition now lives
// with the traversal engine in WorkflowWalker.
export type { InlineWorkflowTraceNode } from '@/modules/analysis/application/workflow/WorkflowWalker';

interface WorkflowTraceContext {
    currentPluginId: string;
    traceCounter: WorkflowTraceCounter;
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

interface ResolvedPluginExecution {
    pluginId: string;
    config: WorkflowNodeOutput;
    selectedTimesteps: number[];
    outputPathMode: 'isolated' | 'parent';
}

interface WorkflowExecutionOutcome {
    output: WorkflowNodeOutput;
    trace: InlineWorkflowTraceNode[];
}

export interface WorkflowExecuteInput {
    jobId: string;
    executionData: AnalysisJobExecutionData;
    outputs: WorkflowOutputs;
    dumpTargets: WorkflowDumpTarget[];
    outputDir: string;
    timestep: number;
    artifactUploadBatch: ArtifactUploadBatch;
    logSinkFactory: WorkflowLogSinkFactory;
    stageReporter?: AnalysisStageReporter;
}

export interface WorkflowExecuteResult {
    trace: InlineWorkflowTraceNode[];
}

@Service('workflowRuntime')
export class WorkflowRuntime {
    private readonly nodeExecutor: WorkflowNodeExecutor;
    private readonly workflowPlanner: WorkflowPlanner;

    constructor(
        workflowNodeRegistry: WorkflowNodeRegistry,
        private readonly pluginBinaryCache: PluginBinaryCache,
        private readonly binaryExecutorService: BinaryExecutorService,
        private readonly resultProcessor: ResultProcessorService,
        private readonly trajectoryFrameStore: TrajectoryFrameStore
    ) {
        this.nodeExecutor = new WorkflowNodeExecutor(workflowNodeRegistry);
        this.workflowPlanner = new WorkflowPlanner(this.nodeExecutor);
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

    async execute(input: WorkflowExecuteInput): Promise<WorkflowExecuteResult> {
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
        const walker = new WorkflowWalker({
            graph,
            session,
            scheduler,
            nodeExecutor: this.nodeExecutor,
            visitedNodeIds,
            pluginId: identity.pluginId,
            delegate: this.createRootWalkerDelegate(input, session)
        });

        await walker.walkFrom(graph.getRuntimeStartNodes());

        return { trace: walker.getTrace() };
    }

    /**
     * Build the {@link WorkflowWalkerDelegate} for the ROOT pass: Plugin nodes
     * flow through `executePluginForRuntime`, Export nodes persist the
     * linked-exposure skip marker, and Entrypoint nodes are wrapped with the
     * `entrypoint` stage reports (`${jobId}:entrypoint:${nodeId}`).
     */
    private createRootWalkerDelegate(
        input: WorkflowExecuteInput,
        session: WorkflowSession
    ): WorkflowWalkerDelegate {
        const { stageReporter } = input;
        const pluginId = input.executionData.identity.pluginId;
        const reportEntrypointStage = async (
            node: WorkflowNode,
            stageStatus: 'running' | 'completed' | 'failed',
            detail?: string
        ): Promise<void> => {
            if (node.type !== WorkflowNodeType.Entrypoint) {
                return;
            }

            await stageReporter?.report({
                stageKey: `${input.jobId}:entrypoint:${node.id}`,
                label: 'Run plugin binary',
                stageType: 'entrypoint',
                stageStatus,
                pluginId,
                nodeId: node.id,
                ...(detail !== undefined ? { detail } : {})
            });
        };

        return {
            executePlugin: async (node, executionPath) => ({
                output: await this.executePluginForRuntime(input, session, node, executionPath)
            }),
            buildNodeContext: (node, executionPath) =>
                this.buildRuntimeNodeContext(input, session, node, executionPath),
            resolveExportOutput: () => ({
                processed: false,
                skipped: true,
                reason: 'Export nodes are processed from their linked exposure'
            }),
            reportNodeRunning: (node) => reportEntrypointStage(node, 'running'),
            reportNodeCompleted: (node) => reportEntrypointStage(node, 'completed'),
            reportNodeFailed: (node, error) => reportEntrypointStage(
                node,
                'failed',
                error instanceof Error ? error.message : undefined
            )
        };
    }

    private async executePluginForRuntime(
        input: WorkflowExecuteInput,
        session: WorkflowSession,
        node: WorkflowNode,
        executionPath: string[]
    ): Promise<WorkflowNodeOutput> {
        if (input.dumpTargets.length === 0) {
            return this.createNestedExecutionResult([]);
        }

        const execution = await this.executePluginNode(
            this.buildPluginExecutionInput(
                input,
                session,
                node,
                executionPath,
                input.dumpTargets[0]!,
                session.outputs,
                input.outputDir
            )
        );
        return execution.output;
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

    private buildRuntimeNodeContext(
        input: WorkflowExecuteInput,
        session: WorkflowSession,
        node: WorkflowNode,
        executionPath: string[]
    ): WorkflowExecutionContext {
        const baseContext = session.context;
        const entrypointExecution = baseContext.execution?.entrypoint;
        if (node.type !== WorkflowNodeType.Entrypoint || !entrypointExecution) {
            return baseContext;
        }

        return {
            ...baseContext,
            execution: {
                ...baseContext.execution,
                entrypoint: {
                    ...entrypointExecution,
                    logSink: input.logSinkFactory({
                        rootNodeId: node.id,
                        nodeId: node.id,
                        nodeType: node.type,
                        pluginId: input.executionData.identity.pluginId,
                        executionPath,
                        timesteps: input.dumpTargets.map((target) => target.timestep)
                    })
                }
            }
        };
    }

    private buildPluginExecutionInput(
        input: WorkflowExecuteInput,
        session: WorkflowSession,
        node: WorkflowNode,
        executionPath: string[],
        dumpTarget: WorkflowDumpTarget,
        outputs: WorkflowOutputs,
        outputDir: string
    ): ExecutePluginNodeInput {
        const { identity } = input.executionData;

        return {
            node,
            workflow: input.executionData.workflow.definition,
            nestedPlugins: input.executionData.workflow.nestedPlugins,
            outputs,
            dumpTarget,
            outputDir,
            trajectoryId: identity.trajectoryId,
            trajectoryFrames: input.executionData.trajectoryFrames,
            analysisId: identity.analysisId,
            analysis: { _id: identity.analysisId, pluginDisplayName: identity.pluginId },
            teamId: identity.teamId,
            ownerClusterId: identity.storageClusterId,
            rootNodeId: node.id,
            executionPath,
            logSinkFactory: input.logSinkFactory,
            stageReporter: input.stageReporter
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

        await input.stageReporter?.report({
            ...stageBase,
            stageStatus: 'running'
        });

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

        try {
            const planningOutcome = await this.workflowPlanner.plan({
                nodes: nestedContext.workflow.topologicalSort(),
                context: nestedContext,
                // Nested planning skip-filter: defer ALL runtime-phase nodes
                // (including control-flow) to the nested runtime pass below.
                shouldSkipNode: (node) => !isPlanningNodeType(node.type),
                hooks: {
                    afterNodeExecuted: ({ node, output, startedAt }) => {
                        let finalOutput = output;

                        if (node.type === WorkflowNodeType.Context) {
                            finalOutput = WorkflowSession.createLocalizedContextOutput(
                                output,
                                localizedDumpTarget,
                                nestedOutputDir
                            );
                            nestedSession.setOutput(node.id, finalOutput);
                        }

                        this.appendTraceNode(trace, workflowTraceContext, {
                            nodeId: node.id,
                            nodeType: node.type,
                            status: 'completed',
                            durationMs: Date.now() - startedAt,
                            output: finalOutput
                        });

                        return finalOutput;
                    },
                    afterNodeSkipped: ({ node, reason, startedAt }) => {
                        this.appendTraceNode(trace, workflowTraceContext, {
                            nodeId: node.id,
                            nodeType: node.type,
                            status: 'skipped',
                            durationMs: Date.now() - startedAt,
                            reason
                        });
                    },
                    onForEach: async ({ output, items }) => {
                        if (!output || !items.length) {
                            await input.stageReporter?.report({
                                ...stageBase,
                                stageStatus: 'completed',
                                detail: 'No nested timesteps selected'
                            });
                            return true;
                        }

                        nestedSession.setForEachCurrentValue(
                            {
                                ...(items[0] as WorkflowNodeOutput),
                                path: input.dumpTarget.localPath
                            } as TrajectoryDumpDescriptor,
                            0,
                            nestedOutputDir
                        );

                        return false;
                    },
                    onError: ({ node, error, startedAt }) => {
                        const runtimeError = error instanceof Error ? error : undefined;
                        const message = runtimeError?.message ?? `Nested node ${node.id} failed`;
                        this.appendTraceNode(trace, workflowTraceContext, {
                            nodeId: node.id,
                            nodeType: node.type,
                            status: 'error',
                            durationMs: Date.now() - startedAt,
                            error: message,
                            stack: runtimeError?.stack
                        });

                        if (workflowTraceContext) {
                            throw createWorkflowTraceFailure(message, trace, error);
                        }

                        throw this.toError(runtimeError, message);
                    }
                }
            });

            // Empty itemization: the ForEach produced no items, so there are no
            // nested timesteps to run. The stage was already reported completed
            // by the onForEach hook above.
            if (planningOutcome.haltedEarly) {
                return {
                    output: this.createNestedExecutionResult([]),
                    trace
                };
            }

            const nestedVisitedNodeIds = new Set<string>();
            const nestedWalker = new WorkflowWalker({
                graph: nestedContext.workflow,
                session: nestedSession,
                scheduler: WorkflowScheduler.forVisitedNodes(
                    nestedContext.workflow,
                    nestedSession.outputs,
                    nestedVisitedNodeIds
                ),
                nodeExecutor: this.nodeExecutor,
                visitedNodeIds: nestedVisitedNodeIds,
                pluginId,
                delegate: this.createNestedWalkerDelegate(
                    input,
                    nestedSession,
                    nestedOutputDir,
                    rootNodeId,
                    workflowTraceContext !== null,
                    logSinkFactory
                ),
                // Share the planning counter so runtime trace ids continue from
                // where planning left off (when tracing is enabled).
                ...(workflowTraceContext ? { traceCounter: workflowTraceContext.traceCounter } : {})
            });

            try {
                // The nested runtime pass reuses the SAME traversal engine as the
                // root execute() path. `executionPath` seeds the walker's base
                // path so nested log-sink breadcrumbs keep the parent prefix, and
                // nested Plugin nodes recurse back through executePluginNode ->
                // executeNestedPluginWorkflow -> a new walker (see
                // createNestedWalkerDelegate), preserving the recursion.
                await nestedWalker.walkFrom(nestedContext.workflow.getRuntimeStartNodes(), executionPath);
            } catch (error) {
                // The walker already appended its error node and threw a
                // trace-carrying failure, but its trace omits the planning
                // prefix; splice the partial runtime trace onto the planning
                // trace so the surfaced failure carries the full nested trace.
                trace.push(...nestedWalker.getTrace());
                if (workflowTraceContext) {
                    const message = error instanceof Error
                        ? error.message
                        : `Nested plugin ${pluginId} failed`;
                    throw createWorkflowTraceFailure(message, trace, error);
                }
                throw error;
            }

            trace.push(...nestedWalker.getTrace());

            const exposures = this.collectNestedExposureArtifacts(nestedSession);
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

    /**
     * Build the {@link WorkflowWalkerDelegate} for a NESTED pluginReference pass.
     * It mirrors the deleted hand-rolled nested traversal:
     *
     *  - `executePlugin` preserves the recursion: a nested Plugin node runs
     *    through {@link executePluginNode} (which calls back into
     *    {@link executeNestedPluginWorkflow} -> a new walker), and its sub-trace
     *    is surfaced as the Plugin trace node's `children`.
     *  - `buildNodeContext` injects the Entrypoint log sink, threading the
     *    original `rootNodeId` and the full `executionPath` breadcrumb.
     *  - No `resolveExportOutput` (nested Export nodes persist nothing and, per
     *    the walker's Export branch, emit no trace node) and no node-lifecycle
     *    reporters (nested has no per-node entrypoint stage reporting).
     */
    private createNestedWalkerDelegate(
        input: WorkflowExecutionBaseInput,
        session: WorkflowSession,
        outputDir: string,
        rootNodeId: string,
        captureTrace: boolean,
        logSinkFactory: WorkflowLogSinkFactory | undefined
    ): WorkflowWalkerDelegate {
        return {
            executePlugin: async (node, executionPath) => {
                const { analysis, trajectoryFrames } = session.context;
                const execution = await this.executePluginNode({
                    node,
                    workflow: session.context.workflow.definition,
                    nestedPlugins: input.nestedPlugins,
                    outputs: session.outputs,
                    dumpTarget: input.dumpTarget,
                    outputDir,
                    trajectoryId: input.trajectoryId,
                    trajectoryFrames,
                    analysisId: input.analysisId,
                    analysis,
                    teamId: input.teamId,
                    ownerClusterId: input.ownerClusterId,
                    captureTrace,
                    rootNodeId,
                    executionPath,
                    logSinkFactory,
                    stageReporter: input.stageReporter
                });

                return { output: execution.output, trace: execution.trace };
            },
            buildNodeContext: (node, executionPath) => {
                const baseContext = session.context;
                const entrypointExecution = baseContext.execution?.entrypoint;
                if (node.type !== WorkflowNodeType.Entrypoint || !entrypointExecution) {
                    return baseContext;
                }

                return {
                    ...baseContext,
                    execution: {
                        ...baseContext.execution,
                        entrypoint: {
                            ...entrypointExecution,
                            logSink: logSinkFactory?.({
                                rootNodeId,
                                nodeId: node.id,
                                nodeType: node.type,
                                pluginId: baseContext.pluginId,
                                executionPath,
                                timesteps: [input.dumpTarget.timestep]
                            })
                        }
                    }
                };
            }
        };
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
