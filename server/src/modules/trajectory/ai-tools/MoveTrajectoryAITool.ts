import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

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
