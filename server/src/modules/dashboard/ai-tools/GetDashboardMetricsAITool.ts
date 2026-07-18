import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { AITool } from '@shared/application/ai/AITool';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import { z } from 'zod';

export class GetDashboardMetricsAITool extends AITool {
    readonly name = 'get_dashboard_metrics';
    readonly description =
        'Get the dashboard overview metrics for the current team: total counts, last-month counts, '
        + 'and weekly time-series for the main resources (trajectories, analyses, etc.).';
    readonly parameters = z.object({});

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const metrics = await teamMetricsQueryService.getTeamMetrics(scope.teamId);

        const totalCount = Object.values(metrics.totals).reduce((sum, value) => sum + value, 0);

        return {
            summary: `Team dashboard metrics: ${totalCount} total resource(s) across ${Object.keys(metrics.totals).length} categor(ies).`,
            data: metrics
        };
    }
}
