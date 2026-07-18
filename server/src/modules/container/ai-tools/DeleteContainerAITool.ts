import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class DeleteContainerAITool extends AITool {
    readonly name = 'delete_container';
    readonly description = 'Delete a Docker container.';
    readonly parameters = z.object({ containerId: z.string(), reason: z.string().optional() });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.delete(scope.teamId, params.containerId, scope.userId);
    }
}
