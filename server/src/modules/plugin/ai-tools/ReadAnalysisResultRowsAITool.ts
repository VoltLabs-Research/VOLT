import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ReadAnalysisResultRowsAITool extends AITool {
    readonly name = 'read_analysis_result_rows';
    readonly description = 'Read individual rows of an analysis result table (paginated) when you need concrete values rather than aggregate statistics.';
    readonly parameters = z.object({
        analysisId: z.string(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.getListingRowsByAnalysisId({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });

        const value = result;
        return {
            summary: `Returned ${value.data.length} of ${value.total} result rows (page ${value.page}/${value.totalPages || 1}).`,
            data: value
        };
    }
}
