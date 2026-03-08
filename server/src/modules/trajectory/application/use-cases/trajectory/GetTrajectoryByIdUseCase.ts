import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTrajectoryByIdInput {
    trajectoryId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<GetTrajectoryByIdInput, GetTrajectoryByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly repository: ITrajectoryRepository
    ) {}

    async execute(input: GetTrajectoryByIdInput): Promise<Result<GetTrajectoryByIdOutputDTO, ApplicationError>> {
        const entity = await this.repository.findById(input.trajectoryId, {
            populate: ['team', 'analysis', 'frames.simulationCell']
        });
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
};
