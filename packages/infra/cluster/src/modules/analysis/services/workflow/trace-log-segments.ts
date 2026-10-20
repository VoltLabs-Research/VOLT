import type { ExecutionLogSegment } from '@shared/contracts/types/execution-log';
import type { InlineWorkflowTraceNode } from '@modules/analysis/services/workflow/WorkflowWalker';

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
    if (!output || Object.keys(output).length === 0) {
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

interface BuildTraceLogSegmentsOptions {
    success: boolean;
}

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
            const duration = ` (${node.durationMs}ms)`;
            const status = STATUS_TEXT[node.status];
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
