import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetTeamMetricsAITool extends AITool {
    readonly name = 'get_trajectory_team_metrics';
    readonly description = 'Get aggregate trajectory and storage metrics for the team.';
    readonly parameters = z.object({});

    #service = new TrajectoryService();

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getTeamMetrics({ teamId: scope.teamId });
        return { summary: 'Retrieved team trajectory metrics.', data: value };
    }
}
