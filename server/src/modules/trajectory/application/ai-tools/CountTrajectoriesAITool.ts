import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';

@injectable()
export class CountTrajectoriesAITool extends AITool {
    readonly name = 'count_trajectories';
    readonly description = 'Count trajectories available for the selected team.';
    readonly parameters = z.object({});

    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const count = await this.trajectoryRepo.count({ team: scope.teamId } as any);
        return { count, text: `${count} trajectories found` };
    }
}
