import {
    InlineWorkflowRuntime,
    type AggregatedTrajectoryFrame,
    type ExecuteInlinePluginNodeInput,
    type InlineWorkflowLogSinkFactory,
    type InlineWorkflowTraceNode
} from './InlineWorkflowRuntime';
import type { InlineWorkflowDumpTarget } from './InlineWorkflowShared';
import type { DaemonAnalysisDocument, WorkflowDefinition } from '@/shared/contracts';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { WorkflowNodeRegistry } from './NodeRegistry';

interface InlineExecutionBaseInput {
    workflow: WorkflowDefinition;
    nestedPlugins: ExecuteInlinePluginNodeInput['nestedPlugins'];
    outputs: ExecuteInlinePluginNodeInput['outputs'];
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

interface ExecutePluginNodeInput extends InlineExecutionBaseInput {
    node: ExecuteInlinePluginNodeInput['node'];
}

export type DebugTraceNodeStatus = InlineWorkflowTraceNode['status'];
export type DebugTraceNode = InlineWorkflowTraceNode;
export type DebugDumpExecutionTarget = InlineWorkflowDumpTarget;

export interface DebugInlineExecutionResult {
    output: Record<string, unknown>;
    trace: DebugTraceNode[];
}

export class DebugInlinePluginRuntime {
    private readonly inlineWorkflowRuntime: InlineWorkflowRuntime;

    constructor(
        registry: WorkflowNodeRegistry,
        pluginBinaryCacheService: PluginBinaryCacheService,
        binaryExecutorService: BinaryExecutorService
    ) {
        this.inlineWorkflowRuntime = new InlineWorkflowRuntime(
            registry,
            pluginBinaryCacheService,
            binaryExecutorService
        );
    }

    async executePluginNode(input: ExecutePluginNodeInput): Promise<DebugInlineExecutionResult> {
        return this.inlineWorkflowRuntime.executePluginNode({
            nestedPlugins: input.nestedPlugins,
            outputs: input.outputs,
            dumpTarget: input.dumpTarget,
            outputDir: input.outputDir,
            trajectoryId: input.trajectoryId,
            trajectoryFrames: input.trajectoryFrames,
            analysisId: input.analysisId,
            analysis: input.analysis,
            teamId: input.teamId,
            node: input.node,
            workflow: input.workflow,
            captureTrace: true,
            rootNodeId: input.rootNodeId,
            executionPath: input.executionPath,
            logSinkFactory: input.logSinkFactory
        });
    }
}
