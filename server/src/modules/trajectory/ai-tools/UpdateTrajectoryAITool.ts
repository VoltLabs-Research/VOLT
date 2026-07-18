import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateTrajectoryAITool extends AITool {
    readonly name = 'update_trajectory';
    readonly description = 'Rename a trajectory or change its public visibility.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        name: z.string(),
        isPublic: z.boolean()
    });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateById({ ...params, ...scope });
    }
}
