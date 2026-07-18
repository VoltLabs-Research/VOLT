import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListContainerFilesAITool extends AITool {
    readonly name = 'list_container_files';
    readonly description = 'List files in a container directory.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string().optional().default('/') });

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.getFiles(scope.teamId, params.containerId, params.path);
    }
}
