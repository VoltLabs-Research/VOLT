import { toRecord } from '@/shared/utils';
import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowModifierHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Modifier;
    readonly outputSchema = { properties: {} };

    async execute(node: any, context: any): Promise<Record<string, unknown>> {
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
}
