import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetContainerByIdAITool extends AITool {
    readonly name = 'get_container_by_id';
    readonly description = 'Get detailed information about a specific container.';
    readonly parameters = z.object({ containerId: z.string() });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.getById(scope.teamId, params.containerId);
    }
}
