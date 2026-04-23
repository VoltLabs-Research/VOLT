import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListContainersAITool extends AITool {
    readonly name = 'list_containers';
    readonly description = 'List all Docker containers in the team.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        
        protected readonly useCase: ListContainersUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            page: params.page,
            limit: params.limit
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.total} containers.`, data: result.value.data };
    }
};
