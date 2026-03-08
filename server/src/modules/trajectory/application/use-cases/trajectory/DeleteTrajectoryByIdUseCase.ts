import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface DeleteTrajectoryByIdInput {
    trajectoryId: string;
};

interface DeleteTrajectoryByIdOutput {
    success: boolean;
};

@injectable()
export default class DeleteTrajectoryByIdUseCase implements IUseCase<DeleteTrajectoryByIdInput, DeleteTrajectoryByIdOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly repository: ITrajectoryRepository
    ) {}

    async execute(input: DeleteTrajectoryByIdInput): Promise<Result<DeleteTrajectoryByIdOutput, ApplicationError>> {
        const deleted = await this.repository.deleteById(input.trajectoryId);
        if (!deleted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }
        return Result.ok({ success: true });
    }
};
