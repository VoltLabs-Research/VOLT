import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { MoveContainerUseCase } from '@modules/container/application/use-cases/MoveContainerUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class MoveContainerAITool extends AITool {
    readonly name = 'move_container';
    readonly description = 'Move a container into a different folder (pass folderId null to move it to the root).';
    readonly parameters = z.object({ containerId: z.string(), folderId: z.string().nullable() });
    protected readonly needsApproval = true;

    constructor(
        protected readonly useCase: MoveContainerUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        await this.useCase.execute({
            containerId: params.containerId,
            folderId: params.folderId,
            teamId: scope.teamId
        });
        return {
            summary: params.folderId === null
                ? 'Moved the container to the root folder.'
                : `Moved the container into folder ${params.folderId}.`,
            data: null
        };
    }
}
