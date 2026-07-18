import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CloneTrajectoryAITool extends AITool {
    readonly name = 'clone_trajectory';
    readonly description = 'Clone an existing trajectory, optionally onto a target cluster.';
    readonly parameters = z.object({
        sourceTrajectoryId: z.string(),
        targetClusterId: z.string().optional()
    });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.cloneTrajectory({ ...params, ...scope });
    }
}
