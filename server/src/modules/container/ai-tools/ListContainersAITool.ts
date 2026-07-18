import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListContainersAITool extends AITool {
    readonly name = 'list_containers';
    readonly description = 'List all Docker containers in the team.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.list(scope.teamId, scope.userId, {
            page: params.page,
            limit: params.limit
        });
        return { summary: `Found ${result.total} containers.`, data: result.data };
    }
}
