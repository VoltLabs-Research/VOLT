import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';

@injectable()
export class DeleteTrajectoryAITool extends AITool {
    readonly name = 'delete_trajectory';
    readonly description = 'Delete a trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor(
        @inject(DeleteTrajectoryByIdUseCase)
        protected readonly useCase: DeleteTrajectoryByIdUseCase
    ) {
        super();
    }
}
