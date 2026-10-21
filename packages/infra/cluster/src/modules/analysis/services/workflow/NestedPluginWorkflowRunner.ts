import { stringifyWorkflowValue } from '@shared/utilities/serialization';
import { WorkflowPlanner } from '@modules/analysis/services/workflow/WorkflowPlanner';
import { WorkflowScheduler } from '@modules/analysis/services/workflow/WorkflowScheduler';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { WorkflowWalker, type InlineWorkflowTraceNode, type WorkflowWalkerDelegate } from '@modules/analysis/services/workflow/WorkflowWalker';
import { isPlanningNodeType } from '@modules/analysis/services/workflow/NodeRegistry';
import { withEntrypointLogSink } from '@modules/analysis/services/workflow/entrypoint-node-context';
import { InlineTraceRecorder } from '@modules/analysis/services/workflow/InlineTraceRecorder';
import {
    createNestedExecutionResult,
    type ResolvedPluginExecution,
    type WorkflowExposureArtifact
} from '@modules/analysis/services/workflow/plugin-node-executions';
import { dir as createTempDir } from 'tmp-promise';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import type { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import type { TrajectoryDumpDescriptor } from '@shared/contracts/types/http-workflow';
import type {
    WorkflowDumpTarget,
    WorkflowLogSinkFactory,
    WorkflowNodeOutput,
    WorkflowOutputs
} from '@shared/contracts/types/workflow.types';
import type { BinaryExecutor, PluginRuntimeProvider } from '@shared/contracts/types/plugin-execution';
import type { TrajectoryFrameStore } from '@shared/contracts/types/trajectory-frame-store';
import type { AnalysisStageReporter } from '@shared/contracts/types/analysis-stage-reporter';
import { NodeType, PluginNodeOutputPathMode } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflow, IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';
import type { AnalysisStageStatus } from '@volt/contracts/modules/analysis/domain';
import type {
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    TrajectoryFrame
} from '@volt/contracts/modules/analysis/daemon';

interface NestedPluginWorkflowInput {
    nestedPlugins: NestedPluginDefinition[];
    outputs: WorkflowOutputs;
    dumpTarget: WorkflowDumpTarget;
    outputDir: string;
    trajectoryId: string;
    trajectoryFrames?: TrajectoryFrame[];
    analysisId: string;
    analysis: DaemonAnalysisDocument;
    teamId: string;
    ownerClusterId?: string;
    rootNodeId: string;
    executionPath: string[];
    logSinkFactory?: WorkflowLogSinkFactory;
    stageReporter?: AnalysisStageReporter;
}

export interface NestedPluginNodeInput extends NestedPluginWorkflowInput {
    node: Pick<IWorkflowNode, 'id' | 'type' | 'data'>;
    workflow?: IWorkflow;
    captureTrace?: boolean;
}

export interface NestedPluginExecutionOutcome {
    output: WorkflowNodeOutput;
    trace: InlineTraceRecorder['nodes'];
}

interface NestedExposureNodeOutput extends WorkflowNodeOutput {
    exposureId?: string;
    name?: string;
    results?: string;
    filePath?: string;
}

interface NestedPluginWorkflowRunnerDependencies {
    nodeExecutor: WorkflowNodeExecutor;
    pluginBinaryCache: PluginRuntimeProvider;
    binaryExecutorService: BinaryExecutor;
    trajectoryFrameStore: TrajectoryFrameStore;
    executePluginNode: (input: NestedPluginNodeInput) => Promise<NestedPluginExecutionOutcome>;
}

type NestedStageReporter = (stageStatus: AnalysisStageStatus, detail?: string) => Promise<void> | undefined;

type PlanningTraceEntry = Omit<InlineWorkflowTraceNode, 'traceId' | 'pluginId' | 'nodeId' | 'nodeType' | 'durationMs'>;

const toInlineDumpDescriptor = (dumpTarget: WorkflowDumpTarget): TrajectoryDumpDescriptor => ({
    timestep: dumpTarget.timestep,
    natoms: dumpTarget.natoms,
    simulationCell: dumpTarget.simulationCell,
    path: dumpTarget.localPath,
    originalPath: dumpTarget.originalPath
});

const readWorkflowDisplayName = (workflow: IWorkflow): string | null => {
    const name = workflow.nodes.find((node) => node.type === NodeType.MODIFIER)?.data.modifier?.name;
    return typeof name === 'string' && name.trim().length > 0 ? name : null;
};

const hashPluginRefConfig = (value: WorkflowNodeOutput): string => crypto
    .createHash('sha256')
    .update(stringifyWorkflowValue(value))
    .digest('hex')
    .slice(0, 24);

const collectExposureArtifacts = (session: WorkflowSession): WorkflowExposureArtifact[] => {
    const artifacts: WorkflowExposureArtifact[] = [];

    for (const node of session.context.workflow.nodes) {
        if (node.type !== NodeType.EXPOSURE) {
            continue;
        }

        const output = session.getOutput(node.id) as NestedExposureNodeOutput | undefined;
        if (!output || output.skipped === true || output.filePath === undefined || output.results === undefined) {
            continue;
        }

        artifacts.push({
            exposureId: output.exposureId ?? node.id,
            name: output.name ?? node.id,
            results: output.results,
            filePath: output.filePath
        });
    }

    return artifacts;
};

export class NestedPluginWorkflowRunner {
    private readonly workflowPlanner: WorkflowPlanner;

    constructor(private readonly dependencies: NestedPluginWorkflowRunnerDependencies) {
        this.workflowPlanner = new WorkflowPlanner(dependencies.nodeExecutor);
    }

    async run(
        input: NestedPluginWorkflowInput,
        execution: ResolvedPluginExecution,
        parentTrace: InlineTraceRecorder
    ): Promise<NestedPluginExecutionOutcome> {
        const { pluginId } = execution;
        const nestedPlugin = input.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        const reportStage = this.createStageReporter(input, execution, nestedPlugin.workflow);
        await fs.mkdir(input.outputDir, { recursive: true });
        const nestedOutputDir = execution.outputPathMode === PluginNodeOutputPathMode.PARENT
            ? input.outputDir
            : (await createTempDir({
                tmpdir: input.outputDir,
                prefix: `inline-${pluginId}-`,
                unsafeCleanup: true
            })).path;
        await reportStage('running');

        const session = this.createNestedSession(input, execution, nestedPlugin.workflow, nestedOutputDir);
        const trace = parentTrace.fork(pluginId);

        try {
            let exposures: WorkflowExposureArtifact[] = [];

            if (!await this.planNestedNodes(input, session, nestedOutputDir, trace, reportStage)) {
                await this.walkNestedNodes(input, session, nestedOutputDir, trace);
                exposures = collectExposureArtifacts(session);
                await reportStage(
                    'completed',
                    `${exposures.length} artifact${exposures.length === 1 ? '' : 's'} generated`
                );
            }

            return {
                output: createNestedExecutionResult(exposures),
                trace: trace.nodes
            };
        } catch (error) {
            await reportStage('failed', error instanceof Error ? error.message : undefined);
            throw error;
        }
    }

    private createStageReporter(
        input: NestedPluginWorkflowInput,
        execution: ResolvedPluginExecution,
        workflow: IWorkflow
    ): NestedStageReporter {
        const { pluginId } = execution;
        const pluginDisplayName = readWorkflowDisplayName(workflow) ?? pluginId;
        const configHash = hashPluginRefConfig(execution.config);
        const stageBase = {
            stageKey: `${input.analysisId}:${input.dumpTarget.timestep}:plugin-ref:${pluginId}:${configHash}`,
            label: pluginDisplayName,
            stageType: 'plugin-ref' as const,
            timestep: input.dumpTarget.timestep,
            pluginId,
            pluginDisplayName,
            configHash,
            nodeId: input.executionPath[input.executionPath.length - 1]
        };

        return (stageStatus, detail) => input.stageReporter?.report({
            ...stageBase,
            stageStatus,
            detail
        });
    }

    private createNestedSession(
        input: NestedPluginWorkflowInput,
        execution: ResolvedPluginExecution,
        workflow: IWorkflow,
        nestedOutputDir: string
    ): WorkflowSession {
        const { pluginId } = execution;
        const { timestep, natoms, simulationCell } = input.dumpTarget;

        return WorkflowSession.createFromDefinition({
            outputs: WorkflowSession.cloneOutputs(input.outputs),
            userConfig: execution.config,
            runtimeArguments: {},
            trajectoryId: input.trajectoryId,
            trajectoryFrames: input.trajectoryFrames?.length
                ? input.trajectoryFrames
                : [{
 timestep, natoms, simulationCell 
}],
            trajectoryDumpOverrides: [toInlineDumpDescriptor(input.dumpTarget)],
            analysis: input.analysis,
            analysisId: input.analysisId,
            pluginId,
            teamId: input.teamId,
            selectedFrameOnly: true,
            selectedTimestep: timestep,
            selectedTimesteps: execution.selectedTimesteps,
            execution: {
                entrypoint: {
                    jobId: `${input.analysisId}:${pluginId}:inline`,
                    outputDir: nestedOutputDir,
                    pluginBinaryCache: this.dependencies.pluginBinaryCache,
                    binaryExecutorService: this.dependencies.binaryExecutorService,
                    trajectoryFrameStore: this.dependencies.trajectoryFrameStore,
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
            workflow,
            nestedPlugins: input.nestedPlugins
        });
    }

    private async planNestedNodes(
        input: NestedPluginWorkflowInput,
        session: WorkflowSession,
        nestedOutputDir: string,
        trace: InlineTraceRecorder,
        reportStage: NestedStageReporter
    ): Promise<boolean> {
        const context = session.context;
        const localizedDumpTarget = WorkflowSession.createLocalDumpDescriptor(
            toInlineDumpDescriptor(input.dumpTarget),
            input.dumpTarget.localPath,
            { originalPath: input.dumpTarget.originalPath }
        );
        const appendNode = (node: IWorkflowNode, startedAt: number, entry: PlanningTraceEntry): void => {
            trace.append({
                nodeId: node.id,
                nodeType: node.type,
                durationMs: Date.now() - startedAt,
                ...entry
            });
        };

        const planningOutcome = await this.workflowPlanner.plan({
            nodes: context.workflow.topologicalSort(),
            context,
            shouldSkipNode: (node) => !isPlanningNodeType(node.type),
            hooks: {
                afterNodeExecuted: ({ node, output, startedAt }) => {
                    const finalOutput = node.type === NodeType.CONTEXT
                        ? session.setOutput(node.id, WorkflowSession.createLocalizedContextOutput(
                            output,
                            localizedDumpTarget,
                            nestedOutputDir
                        ))
                        : output;

                    appendNode(node, startedAt, {
                        status: 'completed',
                        output: finalOutput
                    });

                    return finalOutput;
                },
                afterNodeSkipped: ({ node, reason, startedAt }) => appendNode(node, startedAt, {
                    status: 'skipped',
                    reason
                }),
                onForEach: async ({ output, items }) => {
                    if (!output || !items.length) {
                        await reportStage('completed', 'No nested timesteps selected');
                        return true;
                    }

                    session.setForEachCurrentValue(
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
                    appendNode(node, startedAt, {
                        status: 'error',
                        error: message,
                        stack: runtimeError?.stack
                    });

                    throw trace.isEnabled
                        ? trace.failure(message, error)
                        : runtimeError ?? new Error(message);
                }
            }
        });

        return planningOutcome.haltedEarly;
    }

    private async walkNestedNodes(
        input: NestedPluginWorkflowInput,
        session: WorkflowSession,
        nestedOutputDir: string,
        trace: InlineTraceRecorder
    ): Promise<void> {
        const context = session.context;
        const visitedNodeIds = new Set<string>();
        const walker = new WorkflowWalker({
            graph: context.workflow,
            session,
            scheduler: WorkflowScheduler.forVisitedNodes(context.workflow, session.outputs, visitedNodeIds),
            nodeExecutor: this.dependencies.nodeExecutor,
            visitedNodeIds,
            pluginId: context.pluginId,
            delegate: this.createWalkerDelegate(input, session, nestedOutputDir, trace)
        });

        try {
            await walker.walkFrom(context.workflow.getRuntimeStartNodes(), input.executionPath);
        } catch (error) {
            trace.push(walker.getTrace());
            throw trace.isEnabled
                ? trace.failure(error instanceof Error ? error.message : `Nested plugin ${context.pluginId} failed`, error)
                : error;
        }

        trace.push(walker.getTrace());
    }

    private createWalkerDelegate(
        input: NestedPluginWorkflowInput,
        session: WorkflowSession,
        outputDir: string,
        trace: InlineTraceRecorder
    ): WorkflowWalkerDelegate {
        const { logSinkFactory, rootNodeId } = input;

        return {
            executePlugin: (node, executionPath) => this.dependencies.executePluginNode({
                ...input,
                node,
                workflow: session.context.workflow.definition,
                outputs: session.outputs,
                outputDir,
                trajectoryFrames: session.context.trajectoryFrames,
                captureTrace: trace.isEnabled,
                executionPath
            }),
            buildNodeContext: (node, executionPath) => withEntrypointLogSink(
                session.context,
                node,
                () => logSinkFactory?.({
                    rootNodeId,
                    nodeId: node.id,
                    nodeType: node.type,
                    pluginId: session.context.pluginId,
                    executionPath,
                    timesteps: [input.dumpTarget.timestep]
                })
            )
        };
    }
}
