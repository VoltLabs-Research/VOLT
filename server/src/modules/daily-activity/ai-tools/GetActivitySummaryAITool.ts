import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import DailyActivityService from '@modules/daily-activity/services/DailyActivityService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    range: z.number().int().positive().max(365).optional().describe('Days to look back. Defaults to 7.'),
    scope: z.enum(['team', 'self']).optional().describe('"team" (default) summarizes all members; "self" only the current user.')
});

type GetActivitySummaryParams = z.infer<typeof parameters>;

export class GetActivitySummaryAITool extends AITool<GetActivitySummaryParams> {
    readonly name = 'get_activity_summary';
    readonly description = 'Summarize recent team activity (or just your own) over the last N days — '
        + 'who did what and when. Useful for "what happened this week?" questions.';
    readonly parameters = parameters;

    #service = new DailyActivityService();

    async execute(params: GetActivitySummaryParams, scope: AIToolScope) {
        const { range, records } = await this.#service.getTeamActivitySummary({
            teamId: scope.teamId,
            range: params.range,
            userId: params.scope === 'self' ? scope.userId : undefined
        });
        return {
            summary: `Found ${records.length} activity record(s) over the last ${range} day(s).`,
            data: { range, records }
        };
    }
}
