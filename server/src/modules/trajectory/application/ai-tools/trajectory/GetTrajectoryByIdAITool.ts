import { AITool } from '@shared/application/ai/AITool';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';

import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ITrajectoryFrameRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFrameRepository';

@injectable()
export class GetTrajectoryByIdAITool extends AITool {
    readonly name = 'get_trajectory_by_id';
    readonly description = 'Get detailed information about a specific trajectory by its ID.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    constructor(
        @inject(GetTrajectoryByIdUseCase)
        protected readonly useCase: GetTrajectoryByIdUseCase,

        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository)
        private readonly trajectoryFrameRepository: ITrajectoryFrameRepository
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ trajectoryId: params.trajectoryId });
        if (!result.success) throw result.error;

        const { _id, name, status, isPublic, stats, createdAt } = result.value;
        const framesCount = await this.trajectoryFrameRepository.countFrames(_id);

        return {
            trajectoryId: _id,
            name,
            status,
            isPublic,
            framesCount,
            stats: stats ?? null,
            createdAt
        };
    }
};
