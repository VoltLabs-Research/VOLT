import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListTrajectoriesAITool extends AITool {
    readonly name = 'list_trajectories';
    readonly description = 'List trajectories in the team, optionally filtered by folder or search.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        folderId: z.string().optional(),
        search: z.string().optional()
    });

    constructor(
        protected readonly useCase: GetTrajectoriesByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            folderId: params.folderId,
            search: params.search
        });
        return { summary: `Found ${value.total} trajectories.`, data: value.data };
    }
}
