import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetTeamActivitySummaryUseCase from '@modules/daily-activity/application/use-cases/GetTeamActivitySummaryUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    range: z.number().int().positive().max(365).optional().describe('Days to look back. Defaults to 7.'),
    scope: z.enum(['team', 'self']).optional().describe('"team" (default) summarizes all members; "self" only the current user.')
});

type GetActivitySummaryParams = z.infer<typeof parameters>;

/**
 * Summarizes team (or self) daily activity over a day range. Wraps the
 * extracted GetTeamActivitySummaryUseCase.
 */
@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetActivitySummaryAITool extends AITool<GetActivitySummaryParams> {
    readonly name = 'get_activity_summary';
    readonly description = 'Summarize recent team activity (or just your own) over the last N days — '
        + 'who did what and when. Useful for "what happened this week?" questions.';
    readonly parameters = parameters;

    constructor(protected readonly useCase: GetTeamActivitySummaryUseCase) {
        super();
    }

    async execute(params: GetActivitySummaryParams, scope: AIToolScope) {
        const { range, records } = await this.useCase.execute({
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
