import {
    InlineWorkflowRuntime,
    InlineWorkflowTraceError,
    cloneInlineWorkflowTraceNodes,
    type ExecuteInlinePluginNodeInput,
    type InlineWorkflowExecutionResult,
    type InlineWorkflowLogSinkFactory,
    type InlineWorkflowTraceNode
} from './InlineWorkflowRuntime';
import {
    createInlinePluginReferenceDedupeKey,
    createNestedExecutionResult,
    isInlinePluginReferenceExecutionRequest,
    setNestedValueAtPath,
    type InlineWorkflowDumpTarget
} from './InlineWorkflowShared';
import { WorkflowNodeType } from '../contracts';
import type { PluginReferenceExecutionRequest, WorkflowDefinition } from '@/shared/contracts';
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
    analysisId: string;
    teamId: string;
    trajectoryFrames?: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    rootNodeId?: string;
    executionPath?: string[];
    logSinkFactory?: InlineWorkflowLogSinkFactory;
}

interface ExecutePluginNodeInput extends InlineExecutionBaseInput {
    node: ExecuteInlinePluginNodeInput['node'];
}

interface ExecuteArgumentPluginReferencesInput extends InlineExecutionBaseInput {
    pluginReferenceExecutions: PluginReferenceExecutionRequest[];
}

export type DebugTraceNodeStatus = InlineWorkflowTraceNode['status'];
export type DebugTraceNode = InlineWorkflowTraceNode;
export type DebugDumpExecutionTarget = InlineWorkflowDumpTarget;
export { InlineWorkflowTraceError as DebugTraceError };

export interface DebugInlineExecutionResult {
    output: Record<string, unknown>;
    trace: DebugTraceNode[];
}

export interface DebugInlineArgumentReferencesResult {
    output: Record<string, unknown> | null;
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

    async executeArgumentPluginReferences(input: ExecuteArgumentPluginReferencesInput): Promise<DebugInlineArgumentReferencesResult> {
        let traceCounter = 0;
        const nextTraceId = (): string => `trace_${++traceCounter}`;
        const requests = Array.isArray(input.pluginReferenceExecutions)
            ? input.pluginReferenceExecutions.filter(isInlinePluginReferenceExecutionRequest)
            : [];

        if (!requests.length) {
            return {
                output: null,
                trace: []
            };
        }

        const dedupedRequests = new Map<string, PluginReferenceExecutionRequest>();
        for (const request of requests) {
            const dedupeKey = createInlinePluginReferenceDedupeKey(request);
            if (!dedupedRequests.has(dedupeKey)) {
                dedupedRequests.set(dedupeKey, request);
            }
        }

        const dedupedResults = new Map<string, InlineWorkflowExecutionResult>();
        const trace: DebugTraceNode[] = [];

        for (const [dedupeKey, request] of dedupedRequests.entries()) {
            const startedAt = Date.now();
            try {
                const execution = await this.inlineWorkflowRuntime.executePluginReference({
                    nestedPlugins: input.nestedPlugins,
                    outputs: input.outputs,
                    dumpTarget: input.dumpTarget,
                    outputDir: `${input.outputDir}_plugin_reference`,
                    trajectoryId: input.trajectoryId,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    request,
                    captureTrace: true,
                    rootNodeId: input.rootNodeId,
                    executionPath: input.executionPath,
                    logSinkFactory: input.logSinkFactory
                });
                dedupedResults.set(dedupeKey, execution);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Plugin reference execution failed';
                const stack = error instanceof Error ? error.stack : undefined;
                const nestedTrace = error instanceof InlineWorkflowTraceError
                    ? error.trace
                    : undefined;
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
                throw new InlineWorkflowTraceError(message, trace, { cause: error });
            }
        }

        for (const request of requests) {
            const dedupeKey = createInlinePluginReferenceDedupeKey(request);
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
                children: cloneInlineWorkflowTraceNodes(dedupedExecution.trace, nextTraceId)
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
            const dedupeKey = createInlinePluginReferenceDedupeKey(request);
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
        return this.inlineWorkflowRuntime.executePluginNode({
            nestedPlugins: input.nestedPlugins,
            outputs: input.outputs,
            dumpTarget: input.dumpTarget,
            outputDir: input.outputDir,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            teamId: input.teamId,
            node: input.node,
            captureTrace: true,
            rootNodeId: input.rootNodeId,
            executionPath: input.executionPath,
            logSinkFactory: input.logSinkFactory
        });
    }
}
