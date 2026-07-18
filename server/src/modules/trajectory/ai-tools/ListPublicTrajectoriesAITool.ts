import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ListPublicTeamTrajectoriesUseCase from '@modules/trajectory/use-cases/trajectory/ListPublicTeamTrajectoriesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListPublicTrajectoriesAITool extends AITool {
    readonly name = 'list_public_trajectories';
    readonly description = 'List the publicly shared trajectories for the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        search: z.string().optional()
    });

    constructor(
        protected readonly useCase: ListPublicTeamTrajectoriesUseCase
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
        return { summary: `Found ${value.total} public trajectories.`, data: value.data };
    }
}
