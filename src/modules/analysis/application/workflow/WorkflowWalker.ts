import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowExecutionContext,
    WorkflowGraph,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowValue,
    WorkflowValueMap
} from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeExecutor } from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';
import type { WorkflowScheduler } from '@/modules/analysis/application/workflow/WorkflowScheduler';
import type { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import ApplicationError from '@/app/coordination/ApplicationError';

/**
 * The single runtime graph-traversal engine for the analysis workflow.
 *
 * {@link WorkflowWalker} owns the behavior that the ROOT (`WorkflowRuntime.execute`)
 * and NESTED (`WorkflowRuntime.executeNestedPluginWorkflow`) passes used to
 * duplicate: a depth-first, scheduler-driven walk that
 *
 *  - guards against re-execution via a shared `visitedNodeIds` set,
 *  - activates children through ONE shared {@link WorkflowScheduler}
 *    (`resolveChildNodeIds.activeNodeIds` + `isNodeReady`) — the scheduler is
 *    constructed once by the caller and reused for every child rather than
 *    re-instantiated per node,
 *  - short-circuits Export nodes,
 *  - delegates Plugin execution to a caller-provided callback,
 *  - runs every other node through the shared {@link WorkflowNodeExecutor}, and
 *  - ALWAYS captures an execution trace ({@link InlineWorkflowTraceNode}) with a
 *    per-node `durationMs`, defensively truncating large string payloads.
 *
 * Everything that differs between the root and nested passes is funnelled
 * through {@link WorkflowWalkerDelegate} so the traversal skeleton stays generic
 * and the two callers can keep their (deliberately different) special-cases:
 *
 *  - `executePlugin`  -> how a Plugin node is run (root: `executePluginForRuntime`;
 *                        nested: `executePluginNode` with a nested input).
 *  - `buildNodeContext` -> the execution context handed to the node executor
 *                        (log-sink injection for Entrypoint nodes).
 *  - `resolveExportOutput` -> the output persisted for an Export node (root
 *                        stores a skip marker; nested stores nothing).
 *  - `reportNodeRunning` / `reportNodeCompleted` / `reportNodeFailed` -> optional
 *                        stage reporting around the node-executor path (root
 *                        reports Entrypoint stages; nested reports none).
 *
 * On failure the walker mirrors the nested pass: it appends an `error` trace
 * node and throws a trace-carrying {@link ApplicationError}
 * (see {@link createWorkflowTraceFailure}) so callers can surface the partial
 * trace alongside the error.
 */

export type InlineWorkflowTraceStatus = 'completed' | 'skipped' | 'error';

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

/** Monotonic counter used to stamp stable, unique trace ids. */
export interface WorkflowTraceCounter {
    value: number;
}

export interface WorkflowTraceDetails {
    trace: InlineWorkflowTraceNode[];
}

export const WORKFLOW_TRACE_ERROR_CODE = 'Workflow::Trace';

/**
 * Wrap a failure so the partial execution {@link InlineWorkflowTraceNode trace}
 * travels with it. The original `message` is preserved verbatim so error
 * propagation (what callers log/report) is unchanged; only `details.trace` is
 * added.
 */
export const createWorkflowTraceFailure = (
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

/** Extract the trace carried by a {@link createWorkflowTraceFailure} error. */
export const readWorkflowTrace = (error: unknown): InlineWorkflowTraceNode[] | undefined => {
    if (!(error instanceof ApplicationError) || error.code !== WORKFLOW_TRACE_ERROR_CODE) {
        return undefined;
    }

    const details = error.details as WorkflowTraceDetails | undefined;
    return Array.isArray(details?.trace) ? details.trace : undefined;
};

/**
 * Maximum length, in characters, for any single string embedded in a trace
 * node's `output`. Roughly 8KB. Full process logs are streamed separately, so
 * the trace only needs a bounded, human-readable preview of large payloads.
 */
export const MAX_TRACE_STRING_LENGTH = 8 * 1024;

/**
 * Output fields that are routinely large (raw process output / serialized
 * results) and are therefore always run through truncation. Any OTHER string
 * is also truncated once it exceeds {@link MAX_TRACE_STRING_LENGTH}.
 */
const NOISY_TRACE_FIELDS = new Set(['stdout', 'stderr', 'pluginResult']);

const truncateTraceString = (value: string): string => {
    if (value.length <= MAX_TRACE_STRING_LENGTH) {
        return value;
    }

    const omitted = value.length - MAX_TRACE_STRING_LENGTH;
    return `${value.slice(0, MAX_TRACE_STRING_LENGTH)}… [truncated ${omitted} of ${value.length} chars]`;
};

const sanitizeTraceValue = (value: WorkflowValue, key: string | undefined): WorkflowValue => {
    if (typeof value === 'string') {
        return (key !== undefined && NOISY_TRACE_FIELDS.has(key)) || value.length > MAX_TRACE_STRING_LENGTH
            ? truncateTraceString(value)
            : value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeTraceValue(item as WorkflowValue, undefined));
    }

    if (value !== null && typeof value === 'object') {
        const sanitized: WorkflowValueMap = {};
        for (const [entryKey, entryValue] of Object.entries(value)) {
            sanitized[entryKey] = sanitizeTraceValue(entryValue as WorkflowValue, entryKey);
        }
        return sanitized;
    }

    return value;
};

/**
 * Defensive copy of a node output for trace embedding: deeply truncates the
 * noisy fields ({@link NOISY_TRACE_FIELDS}) and any string longer than
 * {@link MAX_TRACE_STRING_LENGTH}. The original output (persisted via
 * {@link WorkflowSession.setOutput}) is never mutated.
 */
export const sanitizeTraceOutput = (
    output: WorkflowNodeOutput | undefined
): WorkflowNodeOutput | undefined => {
    if (output === undefined) {
        return undefined;
    }

    return sanitizeTraceValue(output, undefined) as WorkflowNodeOutput;
};

export interface WorkflowWalkerPluginExecution {
    output: WorkflowNodeOutput;
    /** Optional nested sub-trace produced while executing the plugin. */
    trace?: InlineWorkflowTraceNode[];
}

/**
 * The pass-specific behavior the {@link WorkflowWalker} delegates to. Implement
 * this once per traversal flavour (root, nested) so the traversal skeleton can
 * stay generic.
 */
export interface WorkflowWalkerDelegate {
    /** Execute a {@link WorkflowNodeType.Plugin} node and return its output. */
    executePlugin(node: WorkflowNode, executionPath: string[]): Promise<WorkflowWalkerPluginExecution>;
    /** Build the execution context handed to the node executor for a node. */
    buildNodeContext(node: WorkflowNode, executionPath: string[]): WorkflowExecutionContext;
    /**
     * Resolve the output persisted for an {@link WorkflowNodeType.Export} node.
     * Return `undefined` to persist nothing (Export nodes never recurse).
     */
    resolveExportOutput?(node: WorkflowNode): WorkflowNodeOutput | undefined;
    /** Reported immediately before a node runs through the node executor. */
    reportNodeRunning?(node: WorkflowNode): void | Promise<void>;
    /** Reported after a node executed successfully (before children are walked). */
    reportNodeCompleted?(node: WorkflowNode): void | Promise<void>;
    /** Reported when the node executor throws (before the error is re-thrown). */
    reportNodeFailed?(node: WorkflowNode, error: unknown): void | Promise<void>;
}

export interface WorkflowWalkerOptions {
    graph: WorkflowGraph;
    session: WorkflowSession;
    /**
     * A single scheduler instance, reused for every child activation. It must be
     * backed by the same `visitedNodeIds`/`outputs` the walker mutates so child
     * readiness reflects live progress (see
     * {@link WorkflowScheduler.forVisitedNodes}).
     */
    scheduler: WorkflowScheduler;
    nodeExecutor: WorkflowNodeExecutor;
    /** Shared visit guard; pre-seeded with already-resolved node ids. */
    visitedNodeIds: Set<string>;
    delegate: WorkflowWalkerDelegate;
    /** Plugin id stamped onto every emitted trace node. */
    pluginId?: string;
    /**
     * Shared trace counter for stable ids. Defaults to a fresh counter; pass a
     * shared one to interleave ids with an outer trace.
     */
    traceCounter?: WorkflowTraceCounter;
}

type WorkflowWalkerTraceEntry = Omit<InlineWorkflowTraceNode, 'traceId' | 'nodeId' | 'nodeType' | 'pluginId'>;

export class WorkflowWalker {
    private readonly graph: WorkflowGraph;
    private readonly session: WorkflowSession;
    private readonly scheduler: WorkflowScheduler;
    private readonly nodeExecutor: WorkflowNodeExecutor;
    private readonly visitedNodeIds: Set<string>;
    private readonly delegate: WorkflowWalkerDelegate;
    private readonly pluginId?: string;
    private readonly traceCounter: WorkflowTraceCounter;
    private readonly trace: InlineWorkflowTraceNode[] = [];

    constructor(options: WorkflowWalkerOptions) {
        this.graph = options.graph;
        this.session = options.session;
        this.scheduler = options.scheduler;
        this.nodeExecutor = options.nodeExecutor;
        this.visitedNodeIds = options.visitedNodeIds;
        this.delegate = options.delegate;
        this.pluginId = options.pluginId;
        this.traceCounter = options.traceCounter ?? { value: 0 };
    }

    /** The trace accumulated so far. The same array reference is carried by any thrown failure. */
    getTrace(): InlineWorkflowTraceNode[] {
        return this.trace;
    }

    /**
     * Walk each start node depth-first. The `executionPath` of a start node is
     * `[...basePath, startNode.id]`. The ROOT pass omits `basePath` (a start
     * node's path is just its own id, identical to before); the NESTED pass
     * passes the parent plugin's `executionPath` so nested log-sink breadcrumbs
     * keep the parent prefix, mirroring the previous nested traversal.
     */
    async walkFrom(startNodes: WorkflowNode[], basePath: string[] = []): Promise<void> {
        for (const startNode of startNodes) {
            await this.walkNode(startNode, [...basePath, startNode.id]);
        }
    }

    private async walkNode(node: WorkflowNode, executionPath: string[]): Promise<void> {
        if (this.visitedNodeIds.has(node.id)) {
            return;
        }
        this.visitedNodeIds.add(node.id);

        const startedAt = Date.now();

        if (node.type === WorkflowNodeType.Export) {
            // Root persists a skip marker (delegate returns it) and records a
            // skipped trace node; nested persists nothing (delegate returns
            // undefined) and — like the previous nested traversal — records no
            // trace node at all. Either way an Export node never recurses.
            const exportOutput = this.delegate.resolveExportOutput?.(node);
            if (exportOutput !== undefined) {
                this.session.setOutput(node.id, exportOutput);
                this.appendTrace(node, {
                    status: 'skipped',
                    durationMs: Date.now() - startedAt,
                    ...(typeof exportOutput.reason === 'string' ? { reason: exportOutput.reason } : {}),
                    output: exportOutput
                });
            }
            return;
        }

        try {
            if (node.type === WorkflowNodeType.Plugin) {
                const execution = await this.delegate.executePlugin(node, executionPath);
                this.session.setOutput(node.id, execution.output);
                this.appendTrace(node, {
                    status: 'completed',
                    durationMs: Date.now() - startedAt,
                    output: execution.output,
                    ...(execution.trace ? { children: execution.trace } : {})
                });
                await this.walkChildren(node, executionPath, execution.output);
                return;
            }

            await this.delegate.reportNodeRunning?.(node);

            let execution: Awaited<ReturnType<WorkflowNodeExecutor['executeNode']>>;
            try {
                execution = await this.nodeExecutor.executeNode(
                    node,
                    this.delegate.buildNodeContext(node, executionPath)
                );
            } catch (error) {
                await this.delegate.reportNodeFailed?.(node, error);
                throw error;
            }

            if (execution.status === 'skipped') {
                this.appendTrace(node, {
                    status: 'skipped',
                    durationMs: Date.now() - startedAt,
                    ...(execution.reason !== undefined ? { reason: execution.reason } : {})
                });
                return;
            }

            const output = execution.output as WorkflowNodeOutput;
            await this.delegate.reportNodeCompleted?.(node);
            this.session.setOutput(node.id, output);

            const skippedReason = output.skipped === true && typeof output.reason === 'string'
                ? output.reason
                : undefined;
            this.appendTrace(node, {
                status: skippedReason !== undefined ? 'skipped' : 'completed',
                durationMs: Date.now() - startedAt,
                output,
                ...(skippedReason !== undefined ? { reason: skippedReason } : {})
            });

            await this.walkChildren(node, executionPath, output);
        } catch (error) {
            const runtimeError = error instanceof Error ? error : undefined;
            const message = runtimeError?.message ?? `Workflow node ${node.id} failed`;
            this.appendTrace(node, {
                status: 'error',
                durationMs: Date.now() - startedAt,
                error: message,
                ...(runtimeError?.stack !== undefined ? { stack: runtimeError.stack } : {})
            });

            throw createWorkflowTraceFailure(message, this.trace, error);
        }
    }

    private async walkChildren(
        node: WorkflowNode,
        executionPath: string[],
        output?: WorkflowNodeOutput
    ): Promise<void> {
        const childNodeIds = output
            ? this.scheduler.resolveChildNodeIds(node, output).activeNodeIds
            : this.graph.getChildNodeIds(node.id);

        for (const childNodeId of childNodeIds) {
            const childNode = this.graph.getNode(childNodeId);
            if (!childNode || !this.scheduler.isNodeReady(childNode.id)) {
                continue;
            }

            await this.walkNode(childNode, [...executionPath, childNode.id]);
        }
    }

    private appendTrace(node: WorkflowNode, entry: WorkflowWalkerTraceEntry): void {
        const sanitized = entry.output !== undefined
            ? { ...entry, output: sanitizeTraceOutput(entry.output) }
            : entry;

        this.trace.push({
            traceId: `trace_${++this.traceCounter.value}`,
            nodeId: node.id,
            nodeType: node.type,
            ...(this.pluginId !== undefined ? { pluginId: this.pluginId } : {}),
            ...sanitized
        });
    }
}
