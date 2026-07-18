import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListAnalysesAITool extends AITool {
    readonly name = 'list_analyses';
    readonly description = 'List all analyses in the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        search: z.string().optional()
    });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getAnalysesByTeamId({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            search: params.search
        });
        return { summary: `Found ${value.total} analyses.`, data: value.data };
    }
}
