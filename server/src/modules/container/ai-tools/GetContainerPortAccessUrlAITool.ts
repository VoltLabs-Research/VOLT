import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetContainerPortAccessUrlAITool extends AITool {
    readonly name = 'get_container_port_access_url';
    readonly description = 'Generate a temporary browser-accessible URL for an exposed port of a running container.';
    readonly parameters = z.object({ containerId: z.string(), port: z.number() });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.createPortAccessUrl(scope.teamId, params.containerId, params.port, scope.userId);
        return { summary: `Generated a temporary access URL for port ${params.port}.`, data: result };
    }
}
