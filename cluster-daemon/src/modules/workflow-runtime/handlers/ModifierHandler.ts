import type { AnalysisRepository } from '../repositories/AnalysisRepository';
import type { TrajectoryRepository } from '../repositories/TrajectoryRepository';
import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowModifierHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Modifier;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly analysisRepository: AnalysisRepository
    ) {}

    async execute(node: any, context: any): Promise<Record<string, unknown>> {
        const [trajectory, analysis] = await Promise.all([
            this.trajectoryRepository.findById(context.trajectoryId),
            this.analysisRepository.findById(context.analysisId)
        ]);

        return {
            ...(node.data.modifier as Record<string, unknown> || {}),
            pluginId: context.pluginId,
            trajectory: trajectory || null,
            analysis: analysis || null
        };
    }
}
