import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class MoveTrajectoryAITool extends AITool {
    readonly name = 'move_trajectory';
    readonly description = 'Move a trajectory into a folder, or to the root when folderId is null.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        folderId: z.string().nullable()
    });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.move({ ...params, ...scope });
    }
}
