import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteTrajectoryAITool extends AITool {
    readonly name = 'delete_trajectory';
    readonly description = 'Delete a trajectory and its analyses.';
    readonly parameters = z.object({ trajectoryId: z.string(), reason: z.string().optional() });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.deleteById({ trajectoryId: params.trajectoryId, ...scope });
    }
}
