import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ReadContainerFileAITool extends AITool {
    readonly name = 'read_container_file';
    readonly description = 'Read a file from a container.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string() });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.readFile(scope.teamId, params.containerId, params.path);
    }
}
