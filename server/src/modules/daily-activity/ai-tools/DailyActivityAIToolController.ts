import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import DailyActivityService from '@modules/daily-activity/services/DailyActivityService';
import type { GetActivitySummaryInput } from '@volt/contracts/modules/daily-activity/ai-tools';

export default class DailyActivityAIToolController extends AIToolController {
    #service = new DailyActivityService();

    @AITool({
        name: 'get_activity_summary',
        description: 'Summarize recent team activity (or just your own) over the last N days — '
            + 'who did what and when. Useful for "what happened this week?" questions.',
        parameters: typia.llm.parameters<GetActivitySummaryInput>(),
        validate: typia.createValidate<GetActivitySummaryInput>()
    })
    async getActivitySummary(input: GetActivitySummaryInput & AIToolScope) {
        const { range, records } = await this.#service.getTeamActivitySummary({
            ...input,
            userId: input.scope === 'self' ? input.userId : undefined
        });
        return {
            summary: `Found ${records.length} activity record(s) over the last ${range} day(s).`,
            data: {
                range,
                records
            }
        };
    }
}
