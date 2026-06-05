import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
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
export default class DeleteTrajectoryByIdUseCase implements IUseCase<DeleteTrajectoryByIdInput, DeleteTrajectoryByIdOutput, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly repository: ITrajectoryRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteTrajectoryByIdInput): Promise<Result<DeleteTrajectoryByIdOutput, ApplicationError>> {
        const trajectory = await this.repository.findById(input.trajectoryId);
        if (!trajectory) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const analysisRuntimeTargets = await this.analysisRepository.findRuntimeTargetsByTrajectoryId(input.trajectoryId);
        const deleted = await this.repository.deleteById(input.trajectoryId);
        if (!deleted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
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

        return Result.ok({ success: true });
    }
};
