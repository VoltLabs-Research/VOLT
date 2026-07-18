import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetTrajectoryAITool extends AITool {
    readonly name = 'get_trajectory';
    readonly description = 'Get detailed information about a specific trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const value = await this.#service.getById({ trajectoryId: params.trajectoryId });
        return { summary: `Trajectory "${value.name}" (${value.status}).`, data: value };
    }
}
