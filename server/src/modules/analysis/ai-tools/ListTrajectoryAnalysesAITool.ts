import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListTrajectoryAnalysesAITool extends AITool {
    readonly name = 'list_trajectory_analyses';
    readonly description = 'List all analyses for a specific trajectory.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getAnalysesByTrajectoryId({
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });
        return { summary: `Found ${value.total} analyses for trajectory ${params.trajectoryId}.`, data: value.data };
    }
}
