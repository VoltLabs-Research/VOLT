import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { TRAJECTORY_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import type { ITeamMetricsQueryService } from '@shared/contracts/ports';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { container as diContainer } from 'tsyringe';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetDashboardMetricsAITool extends AITool {
    readonly name = 'get_dashboard_metrics';
    readonly description =
        'Get the dashboard overview metrics for the current team: total counts, last-month counts, '
        + 'and weekly time-series for the main resources (trajectories, analyses, etc.).';
    readonly parameters = z.object({});

    // Cross-module read service, resolved once from the DI container via its
    // neutral token (owned + registered by the trajectory module).
    #teamMetricsQueryService = diContainer.resolve<ITeamMetricsQueryService>(TRAJECTORY_CONTRACT_TOKENS.TeamMetricsQueryService);

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const metrics = await this.#teamMetricsQueryService.getTeamMetrics(scope.teamId);

        const totalCount = Object.values(metrics.totals).reduce((sum, value) => sum + value, 0);

        return {
            summary: `Team dashboard metrics: ${totalCount} total resource(s) across ${Object.keys(metrics.totals).length} categor(ies).`,
            data: metrics
        };
    }
}
