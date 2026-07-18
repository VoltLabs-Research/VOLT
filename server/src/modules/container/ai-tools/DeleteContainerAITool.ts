import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteContainerAITool extends AITool {
    readonly name = 'delete_container';
    readonly description = 'Delete a Docker container.';
    readonly parameters = z.object({ containerId: z.string(), reason: z.string().optional() });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.delete(scope.teamId, params.containerId, scope.userId);
    }
}
