import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

import { injectable, inject } from 'tsyringe';

import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

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
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly repository: ITrajectoryRepository,

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
            teamCluster: trajectory.props.teamCluster ?? '',
            storageClusterId: resolveTrajectoryStorageClusterId(trajectory.props),
            userId: input.userId ?? '',
            trajectoryName: trajectory.props.name ?? ''
        }));

        return Result.ok({ success: true });
    }
};
