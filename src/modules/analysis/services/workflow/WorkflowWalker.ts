import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type {
    WorkflowExecutionContext,
    WorkflowGraph,
    WorkflowNode,
    WorkflowNodeOutput,
    WorkflowValue,
    WorkflowValueMap
} from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import type { WorkflowScheduler } from '@modules/analysis/services/workflow/WorkflowScheduler';
import type { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import ApplicationError from '@shared/application/errors/ApplicationError';

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

export interface WorkflowTraceCounter {
    value: number;
}

export interface WorkflowTraceDetails {
    trace: InlineWorkflowTraceNode[];
}

export const WORKFLOW_TRACE_ERROR_CODE = 'Workflow::Trace';

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

export const readWorkflowTrace = (error: unknown): InlineWorkflowTraceNode[] | undefined => {
    if (!(error instanceof ApplicationError) || error.code !== WORKFLOW_TRACE_ERROR_CODE) {
        return undefined;
    }

    const details = error.details as WorkflowTraceDetails | undefined;
    return Array.isArray(details?.trace) ? details.trace : undefined;
};

export const MAX_TRACE_STRING_LENGTH = 8 * 1024;

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

    trace?: InlineWorkflowTraceNode[];
}

export interface WorkflowWalkerDelegate {

    executePlugin(node: WorkflowNode, executionPath: string[]): Promise<WorkflowWalkerPluginExecution>;

    buildNodeContext(node: WorkflowNode, executionPath: string[]): WorkflowExecutionContext;

    resolveExportOutput?(node: WorkflowNode): WorkflowNodeOutput | undefined;

    reportNodeRunning?(node: WorkflowNode): void | Promise<void>;

    reportNodeCompleted?(node: WorkflowNode): void | Promise<void>;

    reportNodeFailed?(node: WorkflowNode, error: unknown): void | Promise<void>;
}

export interface WorkflowWalkerOptions {
    graph: WorkflowGraph;
    session: WorkflowSession;

    scheduler: WorkflowScheduler;
    nodeExecutor: WorkflowNodeExecutor;

    visitedNodeIds: Set<string>;
    delegate: WorkflowWalkerDelegate;

    pluginId?: string;

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

    getTrace(): InlineWorkflowTraceNode[] {
        return this.trace;
    }

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
