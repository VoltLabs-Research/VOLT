import { singleton } from '@shared/application/utilities/singleton';
import { getPluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import { getBinaryExecutorService } from '@modules/plugin/services/runtime/BinaryExecutorService';
import { getResultProcessor } from '@modules/plugin/services/exports/ResultProcessor';
import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { type WorkflowNodeRegistry, getWorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import { WorkflowScheduler } from '@modules/analysis/services/workflow/WorkflowScheduler';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import { withEntrypointLogSink } from '@modules/analysis/services/workflow/entrypoint-node-context';
import { InlineTraceRecorder } from '@modules/analysis/services/workflow/InlineTraceRecorder';
import { NestedPluginWorkflowRunner, type NestedPluginExecutionOutcome, type NestedPluginNodeInput } from '@modules/analysis/services/workflow/NestedPluginWorkflowRunner';
import {
    buildAggregatedPluginOutput,
    createNestedExecutionResult,
    resolvePluginExecutionsForNode,
    type PluginExecutionOutput
} from '@modules/analysis/services/workflow/plugin-node-executions';
import {
    WorkflowWalker,
    readWorkflowTrace,
    type InlineWorkflowTraceNode,
    type WorkflowWalkerDelegate
} from '@modules/analysis/services/workflow/WorkflowWalker';

import type {
    WorkflowDumpTarget,
    WorkflowExecutionOptions,
    WorkflowLogSinkFactory,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowOutputs
} from '@shared/contracts/types/workflow.types';
import type { BinaryExecutor, PluginRuntimeProvider } from '@shared/contracts/types/plugin-execution';
import type { AnalysisExecutionIdentity, AnalysisJobExecutionData, DaemonAnalysisDocument } from '@shared/contracts/types/http-analysis';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';
import type { ResultProcessorService } from '@shared/contracts/types/result-processor-service';
import type { TrajectoryFrameStore } from '@shared/contracts/types/trajectory-frame-store';
import type { AnalysisStageReporter } from '@shared/contracts/types/analysis-stage-reporter';
import type { PipelineContext } from '@shared/contracts/types/pipeline-context';

interface WorkflowExecuteInput {
    jobId: string;
    executionData: AnalysisJobExecutionData;
    outputs: WorkflowOutputs;
    dumpTargets: WorkflowDumpTarget[];
    primaryFrameIndex: number;
    outputDir: string;
    timestep: number;
    artifactUploadBatch: ArtifactUploadBatch;
    logSinkFactory: WorkflowLogSinkFactory;
    stageReporter?: AnalysisStageReporter;
    pipelineContext?: PipelineContext;
}

/** The nested runs are keyed off the analysis itself, which carries no plugin document of its own. */
const toAnalysisDocument = (identity: AnalysisExecutionIdentity): DaemonAnalysisDocument => ({
    _id: identity.analysisId,
    pluginDisplayName: identity.pluginId
});

/**
 * Executes an analysis workflow graph for one job, and expands the plugin nodes it
 * meets into nested workflow runs.
 */
export class WorkflowRuntime {
    private readonly nodeExecutor: WorkflowNodeExecutor;
    private readonly nestedRunner: NestedPluginWorkflowRunner;

    constructor(
        workflowNodeRegistry: WorkflowNodeRegistry,
        private readonly pluginBinaryCache: PluginRuntimeProvider,
        private readonly binaryExecutorService: BinaryExecutor,
        private readonly resultProcessor: ResultProcessorService,
        private readonly trajectoryFrameStore: TrajectoryFrameStore
    ) {
        this.nodeExecutor = new WorkflowNodeExecutor(workflowNodeRegistry);
        this.nestedRunner = new NestedPluginWorkflowRunner({
            nodeExecutor: this.nodeExecutor,
            pluginBinaryCache,
            binaryExecutorService,
            trajectoryFrameStore,
            executePluginNode: (input) => this.executePluginNode(input)
        });
    }

    async execute(input: WorkflowExecuteInput): Promise<{ trace: InlineWorkflowTraceNode[] }> {
        const { executionData, outputs } = input;
        const { identity, workflow, trajectoryFrames } = executionData;
        const session = WorkflowSession.createFromDefinition({
            outputs,
            userConfig: {},
            runtimeArguments: {},
            trajectoryId: identity.trajectoryId,
            trajectoryFrames,
            analysis: toAnalysisDocument(identity),
            analysisId: identity.analysisId,
            pluginId: identity.pluginId,
            teamId: identity.teamId,
            execution: this.buildRuntimeExecutionOptions(input),
            selectedTimestep: this.resolvePrimaryDumpTarget(input).timestep,
            workflow: workflow.definition,
            nestedPlugins: workflow.nestedPlugins,
            pipelineContext: input.pipelineContext
        });
        const graph = session.context.workflow;
        const visitedNodeIds = new Set<string>(outputs.keys());
        const walker = new WorkflowWalker({
            graph,
            session,
            scheduler: WorkflowScheduler.forVisitedNodes(graph, outputs, visitedNodeIds),
            nodeExecutor: this.nodeExecutor,
            visitedNodeIds,
            pluginId: identity.pluginId,
            delegate: this.createRootWalkerDelegate(input, session)
        });

        await walker.walkFrom(graph.getRuntimeStartNodes());

        return { trace: walker.getTrace() };
    }

    /**
     * Runs every plugin the node resolves to as its own nested workflow and folds the
     * results into a single node output.
     */
    async executePluginNode(input: NestedPluginNodeInput): Promise<NestedPluginExecutionOutcome> {
        const executions = resolvePluginExecutionsForNode(
            input.workflow,
            input.node.data.pluginNode,
            input.outputs
        );
        if (!executions.length) {
            return {
                output: buildAggregatedPluginOutput([]),
                trace: []
            };
        }

        const trace = input.captureTrace === true
            ? InlineTraceRecorder.enabled(input.node.id)
            : InlineTraceRecorder.disabled();
        const aggregatedExecutions: PluginExecutionOutput[] = [];

        for (const execution of executions) {
            const startedAt = Date.now();
            const executionTrace = trace.fork(execution.pluginId);
            const traceEntry = {
                nodeId: execution.pluginId,
                nodeType: input.node.type,
                label: execution.pluginId
            };

            try {
                const nestedExecution = await this.nestedRunner.run(
                    input,
                    execution.selectedTimesteps.length > 0
                        ? execution
                        : {
                            ...execution,
                            selectedTimesteps: [input.dumpTarget.timestep]
                        },
                    executionTrace
                );
                aggregatedExecutions.push({
                    pluginId: execution.pluginId,
                    output: nestedExecution.output
                });
                executionTrace.append({
                    ...traceEntry,
                    status: 'completed',
                    durationMs: Date.now() - startedAt,
                    output: nestedExecution.output,
                    children: nestedExecution.trace
                });
            } catch (error) {
                const runtimeError = error instanceof Error ? error : undefined;
                const message = runtimeError?.message ?? `Inline plugin ${execution.pluginId} failed`;
                executionTrace.append({
                    ...traceEntry,
                    status: 'error',
                    durationMs: Date.now() - startedAt,
                    error: message,
                    stack: runtimeError?.stack,
                    children: readWorkflowTrace(runtimeError)
                });

                throw trace.isEnabled
                    ? trace.failure(message, error)
                    : runtimeError ?? new Error(message);
            }
        }

        return {
            output: buildAggregatedPluginOutput(aggregatedExecutions),
            trace: trace.nodes
        };
    }

    private createRootWalkerDelegate(
        input: WorkflowExecuteInput,
        session: WorkflowSession
    ): WorkflowWalkerDelegate {
        const { identity } = input.executionData;
        const reportEntrypointStage = async (
            node: WorkflowNode,
            stageStatus: 'running' | 'completed' | 'failed',
            detail?: string
        ): Promise<void> => {
            if (node.type !== WorkflowNodeType.Entrypoint) {
                return;
            }

            await input.stageReporter?.report({
                stageKey: `${input.jobId}:entrypoint:${node.id}`,
                label: 'Run plugin binary',
                stageType: 'entrypoint',
                stageStatus,
                pluginId: identity.pluginId,
                nodeId: node.id,
                ...(detail !== undefined ? { detail } : {})
            });
        };

        return {
            executePlugin: async (node, executionPath) => ({
                output: await this.executeRootPluginNode(input, session, node, executionPath)
            }),
            buildNodeContext: (node, executionPath) => withEntrypointLogSink(
                session.context,
                node,
                () => input.logSinkFactory({
                    rootNodeId: node.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    pluginId: identity.pluginId,
                    executionPath,
                    timesteps: input.dumpTargets.map((target) => target.timestep)
                })
            ),
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

    private async executeRootPluginNode(
        input: WorkflowExecuteInput,
        session: WorkflowSession,
        node: WorkflowNode,
        executionPath: string[]
    ): Promise<WorkflowNodeOutput> {
        if (input.dumpTargets.length === 0) {
            return createNestedExecutionResult([]);
        }

        const { identity, workflow, trajectoryFrames } = input.executionData;
        const execution = await this.executePluginNode({
            node,
            workflow: workflow.definition,
            nestedPlugins: workflow.nestedPlugins,
            outputs: session.outputs,
            dumpTarget: this.resolvePrimaryDumpTarget(input),
            outputDir: input.outputDir,
            trajectoryId: identity.trajectoryId,
            trajectoryFrames,
            analysisId: identity.analysisId,
            analysis: toAnalysisDocument(identity),
            teamId: identity.teamId,
            ownerClusterId: identity.storageClusterId,
            rootNodeId: node.id,
            executionPath,
            logSinkFactory: input.logSinkFactory,
            stageReporter: input.stageReporter
        });

        return execution.output;
    }

    private resolvePrimaryDumpTarget(input: WorkflowExecuteInput): WorkflowDumpTarget {
        const index = Math.max(0, Math.min(input.primaryFrameIndex, input.dumpTargets.length - 1));
        return input.dumpTargets[index]!;
    }

    private buildRuntimeExecutionOptions(input: WorkflowExecuteInput): WorkflowExecutionOptions {
        const { entrypoint, identity } = input.executionData;

        return {
            entrypoint: {
                defaults: {
                    binaryObjectPath: entrypoint.binaryObjectPath,
                    ownerClusterId: entrypoint.ownerClusterId,
                    argumentsTemplate: entrypoint.arguments,
                    entrypointType: entrypoint.type,
                    requirementsFile: entrypoint.requirementsFile,
                    entrypointScript: entrypoint.entrypointScript
                },
                jobId: input.jobId,
                outputDir: input.outputDir,
                pluginBinaryCache: this.pluginBinaryCache,
                binaryExecutorService: this.binaryExecutorService,
                trajectoryFrameStore: this.trajectoryFrameStore,
                ownerClusterId: identity.storageClusterId,
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
}

export const getWorkflowRuntime = singleton((): WorkflowRuntime => new WorkflowRuntime(getWorkflowNodeRegistry(), getPluginBinaryCache(), getBinaryExecutorService(), getResultProcessor(), getTrajectoryFrameStore()));
