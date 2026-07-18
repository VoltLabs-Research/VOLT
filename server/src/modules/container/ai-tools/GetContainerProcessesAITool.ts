import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetContainerProcessesAITool extends AITool {
    readonly name = 'get_container_processes';
    readonly description = 'List running processes in a container.';
    readonly parameters = z.object({ containerId: z.string() });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.getProcesses(scope.teamId, params.containerId);
    }
}
