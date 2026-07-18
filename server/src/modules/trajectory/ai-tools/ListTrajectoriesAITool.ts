import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListTrajectoriesAITool extends AITool {
    readonly name = 'list_trajectories';
    readonly description = 'List trajectories in the team, optionally filtered by folder or search.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        folderId: z.string().optional(),
        search: z.string().optional()
    });

    #service = new TrajectoryService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getByTeamId({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            folderId: params.folderId,
            search: params.search
        });
        return { summary: `Found ${value.total} trajectories.`, data: value.data };
    }
}
