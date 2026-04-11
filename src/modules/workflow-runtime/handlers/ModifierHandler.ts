import { toRecord } from '@/shared/utils';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import { WorkflowNodeType } from '../contracts';
import type { WorkflowNodeHandler } from '../services';

export class WorkflowModifierHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Modifier;
    readonly outputSchema = { properties: {} };

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        return {
            ...toRecord(node.data.modifier),
            pluginId: context.pluginId,
            trajectory: {
                _id: context.trajectoryId,
                frames: context.trajectoryFrames
            },
            analysis: context.analysis || null
        };
    }
};
