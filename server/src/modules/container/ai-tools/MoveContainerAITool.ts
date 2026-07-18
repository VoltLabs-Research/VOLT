import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class MoveContainerAITool extends AITool {
    readonly name = 'move_container';
    readonly description = 'Move a container into a different folder (pass folderId null to move it to the root).';
    readonly parameters = z.object({ containerId: z.string(), folderId: z.string().nullable() });
    protected readonly needsApproval = true;

    #service = new ContainerService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        await this.#service.move(scope.teamId, params.containerId, params.folderId);
        return {
            summary: params.folderId === null
                ? 'Moved the container to the root folder.'
                : `Moved the container into folder ${params.folderId}.`,
            data: null
        };
    }
}
