import { AITool } from '@shared/application/ai/AITool';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryByIdUseCase';

import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

@injectable()
export class UpdateTrajectoryAITool extends AITool {
    readonly name = 'update_trajectory';
    readonly description = 'Update a trajectory.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        name: z.string().optional(),
        isPublic: z.boolean().optional(),
        reason: z.string().optional()
    });

    constructor(
        @inject(UpdateTrajectoryByIdUseCase)
        protected readonly useCase: UpdateTrajectoryByIdUseCase
    ) {
        super();
    }
};
