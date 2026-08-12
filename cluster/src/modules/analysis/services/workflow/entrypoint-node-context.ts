import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type { ProcessExecutionLogSink } from '@shared/contracts/types/execution-log';
import type { WorkflowExecutionContext, WorkflowNode } from '@shared/contracts/types/workflow.types';

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
