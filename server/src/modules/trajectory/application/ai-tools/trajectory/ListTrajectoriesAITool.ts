import { AITool } from '@shared/application/ai/AITool';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';

import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { TrajectoryPersistedDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';

@injectable()
export class ListTrajectoriesAITool extends AITool {
    readonly name = 'list_trajectories';
    readonly description = 'List all trajectories in the selected team with their status, frames count, and dates.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    constructor(
        @inject(GetTrajectoriesByTeamIdUseCase)
        protected readonly useCase: GetTrajectoriesByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });
        if (!result.success) throw result.error;

        return {
            summary: `Found ${result.value.total} trajectories.`,
            data: result.value.data.map((trajectory: TrajectoryPersistedDTO) => ({
                trajectoryId: trajectory._id,
                name: trajectory.name,
                status: trajectory.status,
                framesCount: Array.isArray(trajectory.frames) ? trajectory.frames.length : 0,
                isPublic: trajectory.isPublic,
                createdAt: trajectory.createdAt ?? null
            })),
            total: result.value.total
        };
    }
};
