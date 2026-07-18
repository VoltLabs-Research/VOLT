import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class DeleteTrajectoryFolderAITool extends AITool {
    readonly name = 'delete_trajectory_folder';
    readonly description = 'Delete a trajectory folder and all trajectories within it.';
    readonly parameters = z.object({ folderId: z.string(), reason: z.string().optional() });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.deleteFolder(scope.teamId, params.folderId);
    }
}
