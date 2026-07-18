import { COMPUTE_TOKENS } from '@shared/contracts/tokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

import { inject, injectable } from 'tsyringe';


interface DeleteTrajectoryByIdInput {
    trajectoryId: string;
    teamId?: string;
    userId?: string;
};

interface DeleteTrajectoryByIdOutput {
    success: boolean;
};

@injectable()
export default class DeleteTrajectoryByIdUseCase implements IUseCase<DeleteTrajectoryByIdInput, DeleteTrajectoryByIdOutput> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly repository: ITrajectoryRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteTrajectoryByIdInput): Promise<DeleteTrajectoryByIdOutput> {
        const trajectory = await this.repository.findById(input.trajectoryId);
        if (!trajectory) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        const analysisRuntimeTargets = await this.analysisRepository.findRuntimeTargetsByTrajectoryId(input.trajectoryId);
        const deleted = await this.repository.deleteById(input.trajectoryId);
        if (!deleted) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        await this.eventBus.publish(new TrajectoryDeletedEvent({
            trajectoryId: input.trajectoryId,
            teamId: input.teamId ?? trajectory.props.team ?? '',
            storageClusterId: resolveTrajectoryStorageClusterId(trajectory.props),
            userId: input.userId ?? '',
            trajectoryName: trajectory.props.name,
            analysisIds: analysisRuntimeTargets.map((target) => target.analysisId),
            analysisComputeClusterIds: [
                ...new Set(
                    analysisRuntimeTargets
                        .map((target) => target.computeClusterId)
                        .filter((value): value is string => typeof value === 'string' && value.length > 0)
                )
            ]
        }));

        return { success: true };
    }
};
