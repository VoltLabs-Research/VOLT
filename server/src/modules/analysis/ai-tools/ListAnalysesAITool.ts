import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetAnalysesByTeamIdUseCase from '@modules/analysis/use-cases/GetAnalysesByTeamIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListAnalysesAITool extends AITool {
    readonly name = 'list_analyses';
    readonly description = 'List all analyses in the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        search: z.string().optional()
    });

    constructor(
        protected readonly useCase: GetAnalysesByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            search: params.search
        });
        return { summary: `Found ${value.total} analyses.`, data: value.data };
    }
}
