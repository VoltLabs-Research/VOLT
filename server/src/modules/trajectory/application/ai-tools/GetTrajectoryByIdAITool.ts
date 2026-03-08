import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';

@injectable()
export class GetTrajectoryByIdAITool extends AITool {
    readonly name = 'get_trajectory_by_id';
    readonly description = 'Get detailed information about a specific trajectory by its ID.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    constructor(
        @inject(GetTrajectoryByIdUseCase)
        protected readonly useCase: GetTrajectoryByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ trajectoryId: params.trajectoryId });
        if (!result.success) throw result.error;
        const { _id, name, status, isPublic, frames, stats, createdAt } = result.value;
        return { trajectoryId: _id, name, status, isPublic, framesCount: Array.isArray(frames) ? frames.length : 0, stats: stats ?? null, createdAt };
    }
}
