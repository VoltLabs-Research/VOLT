import type { ExecutionLogSegment } from '@/core/runtime/contracts/execution-log';
import type { InlineWorkflowTraceNode } from '@/modules/analysis/application/workflow/WorkflowWalker';

/**
 * Renders the always-on execution {@link InlineWorkflowTraceNode trace} into
 * frame-log {@link ExecutionLogSegment segments} so it can ride the EXISTING,
 * already-persisted `analysis-log-chunk` channel into the per-frame analysis
 * log. This is what makes observability symmetric: the daemon emits the trace
 * on BOTH success and failure of the workflow, instead of the previous
 * behavior where the rich trace only survived inside debug sessions / thrown
 * errors and never reached the production frame log.
 *
 * Per the approved tracing decision the node `output` IS included. Individual
 * string fields are already bounded by the walker (MAX_TRACE_STRING_LENGTH);
 * here we additionally cap the serialized-output preview per node so a single
 * node with many fields cannot dominate the frame log.
 */

const MAX_SERIALIZED_OUTPUT_LENGTH = 16 * 1024;

const STATUS_TEXT: Record<InlineWorkflowTraceNode['status'], string> = {
    completed: 'ok',
    skipped: 'skipped',
    error: 'error'
};

const truncate = (value: string, max: number): string => {
    if (value.length <= max) {
        return value;
    }

    const omitted = value.length - max;
    return `${value.slice(0, max)}… [truncated ${omitted} of ${value.length} chars]`;
};

const serializeOutput = (output: InlineWorkflowTraceNode['output']): string | null => {
    if (!output || typeof output !== 'object' || Object.keys(output).length === 0) {
        return null;
    }

    let serialized: string;
    try {
        serialized = JSON.stringify(output);
    } catch {
        serialized = String(output);
    }

    if (!serialized || serialized === '{}') {
        return null;
    }

    return truncate(serialized, MAX_SERIALIZED_OUTPUT_LENGTH);
};

export interface BuildTraceLogSegmentsOptions {
    success: boolean;
}

/**
 * Depth-first flattens the trace tree into segments. Hierarchy is preserved two
 * ways: visually via indentation in the segment text, and structurally via
 * `executionPath` (the chain of ancestor node ids) which the frame-log schema
 * already carries on every segment.
 */
export const buildTraceLogSegments = (
    trace: InlineWorkflowTraceNode[],
    options: BuildTraceLogSegmentsOptions
): ExecutionLogSegment[] => {
    if (trace.length === 0) {
        return [];
    }

    const occurredAt = new Date().toISOString();
    const segments: ExecutionLogSegment[] = [{
        stream: 'system',
        occurredAt,
        text: `[Volt] Execution trace (${options.success ? 'success' : 'failure'}):\n`
    }];

    const walk = (nodes: InlineWorkflowTraceNode[], depth: number, ancestry: string[]): void => {
        for (const node of nodes) {
            const executionPath = [...ancestry, node.nodeId];
            const indent = '  '.repeat(depth + 1);
            const label = node.label ?? node.nodeType;
            const duration = Number.isFinite(node.durationMs) ? ` (${node.durationMs}ms)` : '';
            const status = STATUS_TEXT[node.status] ?? node.status;
            const suffix = node.status === 'error' && node.error
                ? ` — ${node.error}`
                : node.status === 'skipped' && node.reason
                    ? ` — ${node.reason}`
                    : '';

            segments.push({
                stream: node.status === 'error' ? 'stderr' : 'system',
                occurredAt,
                text: `${indent}${node.nodeType} ${label}: ${status}${duration}${suffix}\n`,
                nodeId: node.nodeId,
                nodeType: node.nodeType,
                nodeLabel: node.label,
                pluginId: node.pluginId,
                executionPath
            });

            const serializedOutput = serializeOutput(node.output);
            if (serializedOutput !== null) {
                segments.push({
                    stream: 'system',
                    occurredAt,
                    text: `${indent}  ↳ output: ${serializedOutput}\n`,
                    nodeId: node.nodeId,
                    nodeType: node.nodeType,
                    nodeLabel: node.label,
                    pluginId: node.pluginId,
                    executionPath
                });
            }

            if (node.children && node.children.length > 0) {
                walk(node.children, depth + 1, executionPath);
            }
        }
    };

    walk(trace, 0, []);

    return segments;
};
