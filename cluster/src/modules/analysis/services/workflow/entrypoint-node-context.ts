import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { ProcessExecutionLogSink } from '@shared/contracts/types/execution-log';
import type { WorkflowExecutionContext, WorkflowNode } from '@shared/contracts/types/workflow.types';

/**
 * Entrypoint nodes are the only ones that stream process output, so they run against
 * a context carrying their own log sink. Every other node reuses the session context
 * untouched, and `createLogSink` is never called for them.
 */
export const withEntrypointLogSink = (
    baseContext: WorkflowExecutionContext,
    node: WorkflowNode,
    createLogSink: () => ProcessExecutionLogSink | undefined
): WorkflowExecutionContext => {
    const entrypoint = baseContext.execution?.entrypoint;
    if (node.type !== WorkflowNodeType.Entrypoint || !entrypoint) {
        return baseContext;
    }

    return {
        ...baseContext,
        execution: {
            ...baseContext.execution,
            entrypoint: {
                ...entrypoint,
                logSink: createLogSink()
            }
        }
    };
};
