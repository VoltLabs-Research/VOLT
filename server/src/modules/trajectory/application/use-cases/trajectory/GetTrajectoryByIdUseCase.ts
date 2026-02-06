import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryByIdInputDTO, GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<GetTrajectoryByIdInputDTO, GetTrajectoryByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: GetTrajectoryByIdInputDTO): Promise<Result<GetTrajectoryByIdOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;
        const result = await this.trajectoryRepo.findById(trajectoryId, {
            populate: ['team', 'analysis', 'frames.simulationCell']
        });
        if (!result) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        return Result.ok(result.props);
    }
};