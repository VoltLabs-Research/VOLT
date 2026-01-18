import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { DeleteTrajectoryByIdInputDTO } from '@modules/trajectory/application/dtos/trajectory/DeleteTrajectoryByIdDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';

@injectable()
export default class DeleteTrajectoryByIdUseCase implements IUseCase<DeleteTrajectoryByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: DeleteTrajectoryByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { trajectoryId } = input;
        const result = await this.trajectoryRepo.deleteById(trajectoryId);
        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }
        return Result.ok(null);
    }
};