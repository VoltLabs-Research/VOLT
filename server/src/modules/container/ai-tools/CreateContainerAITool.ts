import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CreateContainerAITool extends AITool {
    readonly name = 'create_container';
    readonly description = 'Create a new Docker container.';
    readonly parameters = z.object({
        name: z.string(),
        image: z.string(),
        tag: z.string().optional(),
        ports: z.array(z.object({
            container: z.number(),
            host: z.number()
        })).optional(),
        reason: z.string().optional()
    });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.create(scope.teamId, scope.userId, {
            name: params.name,
            image: params.image,
            ports: params.ports?.map((port) => ({ private: port.container, public: port.host }))
        });
    }
}
