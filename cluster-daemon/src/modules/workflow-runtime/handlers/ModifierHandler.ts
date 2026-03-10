import type { AnalysisLookup } from '../factories';
import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowModifierHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Modifier;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly analysisLookup: AnalysisLookup
    ) {}

    async execute(node: any, context: any): Promise<Record<string, unknown>> {
        const analysis = await this.analysisLookup.findById(context.analysisId);

        return {
            ...(node.data.modifier as Record<string, unknown> || {}),
            pluginId: context.pluginId,
            trajectory: {
                _id: context.trajectoryId,
                frames: context.trajectoryFrames
            },
            analysis: analysis || null
        };
    }
}
