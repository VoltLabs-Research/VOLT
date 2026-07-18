import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class UpdateContainerAITool extends AITool {
    readonly name = 'update_container';
    readonly description = 'Update a Docker container.';
    readonly parameters = z.object({
        containerId: z.string(),
        name: z.string().optional(),
        reason: z.string().optional()
    });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.update(scope.teamId, params.containerId, {});
    }
}
