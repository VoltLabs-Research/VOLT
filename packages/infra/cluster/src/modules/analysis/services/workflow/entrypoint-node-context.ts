import type { ProcessExecutionLogSink } from '@shared/contracts/types/execution-log';
import type { WorkflowExecutionContext } from '@shared/contracts/types/workflow.types';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

export const withEntrypointLogSink = (
    baseContext: WorkflowExecutionContext,
    node: IWorkflowNode,
    createLogSink: () => ProcessExecutionLogSink | undefined
): WorkflowExecutionContext => {
    const entrypoint = baseContext.execution?.entrypoint;
    if (node.type !== NodeType.ENTRYPOINT || !entrypoint) {
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
