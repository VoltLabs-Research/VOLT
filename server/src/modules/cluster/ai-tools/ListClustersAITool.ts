import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ListTeamClustersByTeamIdUseCase from '@modules/cluster/use-cases/ListTeamClustersByTeamIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListClustersAITool extends AITool {
    readonly name = 'list_clusters';
    readonly description = 'List the team compute clusters.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        search: z.string().optional()
    });

    constructor(
        protected readonly useCase: ListTeamClustersByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            search: params.search
        });
        return { summary: `Found ${result.total} clusters.`, data: result.data };
    }
}
